import { defineErrorCodes, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { generateRandomString } from "better-auth/crypto";
import { z } from "zod";

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
  const otp = generateRandomString(length, "0-9");

  return String(otp).padStart(length, "0");
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
  const otp = generateOtp(config.length);
  const expiresAt = getExpirationDate(config.expirationMinutes);

  return {
    otp,
    identifier,
    expiresAt,
  };
};

export const changeEmailOTP = (params: Params) =>
  ({
    id: "change-email-otp",
    endpoints: {
      sendChangeEmailOTP: createAuthEndpoint(
        "/change-email-otp/send",
        {
          method: "POST",
          body: z.object({
            email: z.email().trim().toLowerCase().meta({
              required: true,
              description: "The email to send the change email OTP to",
            }),
          }),
          use: [sessionMiddleware],
          metadata: {
            openapi: {
              operationId: "sendChangeEmailOTP",
              description: "Send change email OTP",
              tags: ["Change-email-otp"],
              responses: {
                200: {
                  description: "Send change email OTP successfully",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                        },
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

          if (!ctx.context.session) throw ctx.error("UNAUTHORIZED");

          const { identifier, otp, expiresAt } = createOtp(
            `change-email-otp-${email}`,
            params.options,
          );

          const emailAlreadyExists =
            await ctx.context.internalAdapter.findUserByEmail(email);

          if (emailAlreadyExists) {
            throw ctx.error("BAD_REQUEST", {
              message: ERROR_CODES.EMAIL_ALREADY_EXISTS,
            });
          }

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
              description: "The email to verify the change email OTP for",
            }),
            otp: z
              .string()
              .min(params.options?.length ?? defaultOptions.length)
              .max(params.options?.length ?? defaultOptions.length)
              .meta({
                required: true,
                description: "The OTP to verify the change email OTP for",
              }),
          }),
          use: [sessionMiddleware],
          metadata: {
            openapi: {
              operationId: "verifyChangeEmailOTP",
              description: "Verify change email OTP",
              tags: ["Change-email-otp"],
              responses: {
                200: {
                  description: "Verify change email OTP successfully",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                        },
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

          if (!verificationValue) {
            throw ctx.error("BAD_REQUEST", {
              message: ERROR_CODES.INVALID_OTP,
            });
          }

          if (verificationValue.expiresAt < new Date()) {
            throw ctx.error("BAD_REQUEST", {
              message: ERROR_CODES.OTP_EXPIRED,
            });
          }

          const [storedOtp, storedOtpAttempts] =
            verificationValue.value.split(":");

          const allowedAttempts =
            params.options?.maxAttempts ?? defaultOptions.maxAttempts;

          if (
            storedOtpAttempts &&
            Number.parseInt(storedOtpAttempts, 10) >= allowedAttempts
          ) {
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
              {
                value: `${storedOtp}:${Number.parseInt(storedOtpAttempts, 10) + 1}`,
              },
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
        pathMatcher(path) {
          return path === "/send-change-email-otp";
        },
        window: 60,
        max: 3,
      },
      {
        pathMatcher(path) {
          return path === "/verify-change-email-otp";
        },
        window: 60,
        max: 3,
      },
    ],
  }) satisfies BetterAuthPlugin;
