import { defineErrorCodes, z, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { generateRandomString } from "better-auth/crypto";

interface OtpOptions {
  length?: number;
  expirationMinutes?: number;
  maxAttempts?: number;
}

interface SendChangeEmailOTPParams {
  email: string;
  otp: string;
}

interface Params {
  options?: OtpOptions;
  sendChangeEmailOTP: (params: SendChangeEmailOTPParams) => Promise<void>;
}

const defaultOptions: Required<OtpOptions> = {
  length: 6,
  expirationMinutes: 5,
  maxAttempts: 3,
};

const generateOtp = (length: number) => {
  return generateRandomString(length, "0-9").padStart(length, "0");
};

const getExpirationDate = (expirationMinutes: number) => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);
  return expiresAt;
};

const ERROR_CODES = defineErrorCodes({
  OTP_EXPIRED: "OTP expired",
  INVALID_OTP: "Invalid OTP",
  TOO_MANY_ATTEMPTS: "Too many attempts",
  EMAIL_ALREADY_EXISTS: "Email already exists",
});

const createOtp = (identifier: string, options: OtpOptions = {}) => {
  const config = { ...defaultOptions, ...options };
  return {
    otp: generateOtp(config.length),
    identifier,
    expiresAt: getExpirationDate(config.expirationMinutes),
  };
};

export const changeEmailOTP = (params: Params): BetterAuthPlugin => {
  const opts = { ...defaultOptions, ...params.options };

  return {
    id: "change-email-otp",
    endpoints: {
      sendChangeEmailOTP: createAuthEndpoint(
        "/change-email-otp/send",
        {
          method: "POST",
          body: z.object({
            email: z.email().trim().toLowerCase().meta({
              required: true,
              description: "The email address for sending the change email OTP",
            }),
          }),
          use: [sessionMiddleware],
          metadata: {
            openapi: {
              operationId: "sendChangeEmailOTP",
              description: "Send OTP to change email",
              responses: {
                200: {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { success: { type: "boolean" } },
                        required: ["success"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async (ctx) => {
          const { email } = ctx.body;
          const session = ctx.context.session;
          if (!session) throw ctx.error("UNAUTHORIZED");

          const { otp, identifier, expiresAt } = createOtp(
            `change-email-otp-${email}`,
            opts,
          );

          const emailExists =
            await ctx.context.internalAdapter.findUserByEmail(email);
          if (emailExists)
            throw ctx.error("BAD_REQUEST", {
              message: ERROR_CODES.EMAIL_ALREADY_EXISTS,
            });

          await ctx.context.internalAdapter
            .createVerificationValue({
              identifier,
              value: `${otp}:0`,
              expiresAt,
            })
            .catch(async () => {
              await ctx.context.internalAdapter.deleteVerificationByIdentifier(
                identifier,
              );
              await ctx.context.internalAdapter.createVerificationValue({
                identifier,
                value: `${otp}:0`,
                expiresAt,
              });
            });

          await params.sendChangeEmailOTP({ email, otp });
          return ctx.json({ success: true });
        },
      ),
      verifyChangeEmailOTP: createAuthEndpoint(
        "/change-email-otp/verify",
        {
          method: "POST",
          body: z.object({
            email: z.email().trim().toLowerCase().meta({
              required: true,
              description: "The email address to verify the change email OTP",
            }),
            otp: z
              .string()
              .min(params.options?.length ?? defaultOptions.length)
              .max(params.options?.length ?? defaultOptions.length)
              .meta({
                required: true,
                description: "The OTP used to verify the change email OTP",
              }),
          }),
          use: [sessionMiddleware],
          metadata: {
            openapi: {
              operationId: "verifyChangeEmailOTP",
              description: "Verify OTP for changing email",
              responses: {
                200: {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { success: { type: "boolean" } },
                        required: ["success"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        async (ctx) => {
          const { email, otp } = ctx.body;
          const session = ctx.context.session;
          if (!session) throw ctx.error("UNAUTHORIZED");

          const identifier = `change-email-otp-${email}`;
          const verificationValue =
            await ctx.context.internalAdapter.findVerificationValue(identifier);

          if (!verificationValue)
            throw ctx.error("BAD_REQUEST", {
              message: ERROR_CODES.INVALID_OTP,
            });
          if (verificationValue.expiresAt < new Date())
            throw ctx.error("BAD_REQUEST", {
              message: ERROR_CODES.OTP_EXPIRED,
            });

          const [storedOtp, attemptsStr] = verificationValue.value.split(":");
          const attempts = parseInt(attemptsStr, 10) || 0;

          if (attempts >= opts.maxAttempts) {
            await ctx.context.internalAdapter.deleteVerificationValue(
              verificationValue.id,
            );
            throw ctx.error("BAD_REQUEST", {
              message: ERROR_CODES.TOO_MANY_ATTEMPTS,
            });
          }

          if (storedOtp !== otp) {
            await ctx.context.internalAdapter.updateVerificationValue(
              verificationValue.id,
              { value: `${storedOtp}:${attempts + 1}` },
            );
            throw ctx.error("BAD_REQUEST", {
              message: ERROR_CODES.INVALID_OTP,
            });
          }

          await ctx.context.internalAdapter.deleteVerificationValue(
            verificationValue.id,
          );
          await ctx.context.internalAdapter.updateUser(session.user.id, {
            email,
            emailVerified: true,
          });

          return ctx.json({ success: true });
        },
      ),
    },
    $ERROR_CODES: ERROR_CODES,
    rateLimit: [
      {
        pathMatcher: (p) => p === "/change-email-otp/send",
        window: 60,
        max: 3,
      },
      {
        pathMatcher: (p) => p === "/change-email-otp/verify",
        window: 60,
        max: 3,
      },
    ],
  };
};
