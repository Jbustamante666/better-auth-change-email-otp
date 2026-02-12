# Better Auth Change Email OTP Plugin

A [Better Auth](https://www.better-auth.com/) plugin that lets authenticated users change their email using OTP (One-Time Password) verification.

## ✅ Current plugin behavior (implemented)

This README reflects what is currently implemented in code:

- Configurable numeric OTP generation (default: 6 digits)
- OTP delivery to the new email through a required `sendChangeEmailOTP` callback
- OTP verification with failed-attempt limits (default: 3)
- Automatic OTP expiration (default: 5 minutes)
- Validation to prevent changing to an email already in use
- Safe OTP replacement when requesting a new code for the same email
- Successful verification updates `user.email` and sets `emailVerified: true`
- Typed endpoints with OpenAPI metadata
- Client plugin for server plugin type inference
- Built-in rate limiting for send and verify endpoints

## 📦 Installation

```bash
npm install better-auth-change-email-otp-plugin
# or
pnpm add better-auth-change-email-otp-plugin
# or
yarn add better-auth-change-email-otp-plugin
```

## 📚 Required Dependencies

Install these in your app:

- `better-auth` (required)

The plugin package already includes `better-auth` in its own dependencies, but your Better Auth app must also have it configured.

### Optional dependencies

- Any email provider SDK you want to use inside `sendChangeEmailOTP` (for example: Resend, SendGrid, Nodemailer).

## 🔧 Server Configuration

```ts
import { betterAuth } from "better-auth";
import { changeEmailOTP } from "better-auth-change-email-otp-plugin";

export const auth = betterAuth({
  // ...your config
  plugins: [
    changeEmailOTP({
      options: {
        length: 6,
        expirationMinutes: 5,
        maxAttempts: 3,
      },
      sendChangeEmailOTP: async ({ email, otp }) => {
        // Implement your provider here (Resend, SendGrid, Nodemailer, etc.)
        await sendEmail({
          to: email,
          subject: "Email change verification code",
          body: `Your code is: ${otp}`,
        });
      },
    }),
  ],
});
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `length` | `number` | `6` | Numeric OTP length |
| `expirationMinutes` | `number` | `5` | OTP expiration in minutes |
| `maxAttempts` | `number` | `3` | Max failed attempts before invalidation |

## 🧩 Client Configuration

```ts
import { createAuthClient } from "better-auth/client"; // or better-auth/react
import { changeEmailOTPClient } from "better-auth-change-email-otp-plugin/client";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [changeEmailOTPClient()],
});
```

## 🚀 Usage

### 1) Send OTP

```ts
const result = await authClient.sendChangeEmailOTP({
  email: "new@email.com",
});

if (result.data?.success) {
  console.log("OTP sent");
}
```

### 2) Verify OTP and change email

```ts
const result = await authClient.verifyChangeEmailOTP({
  email: "new@email.com",
  otp: "123456",
});

if (result.data?.success) {
  console.log("Email updated");
}
```

## 🔗 Created Endpoints

- `POST /change-email-otp/send`
- `POST /change-email-otp/verify`

Both endpoints require an authenticated session (`sessionMiddleware`).

## 🔒 Security & Validation

- Email is normalized with `trim().toLowerCase()`
- If target email already exists, returns `EMAIL_ALREADY_EXISTS`
- OTP is stored as `otp:attempts` to track failed attempts
- When `maxAttempts` is reached, OTP is deleted and `TOO_MANY_ATTEMPTS` is returned
- Expired OTP returns `OTP_EXPIRED`
- Invalid OTP increments attempts and returns `INVALID_OTP`
- Valid OTP deletes verification and updates:
  - `user.email`
  - `user.emailVerified = true`

## ⏱️ Built-in Rate Limit

- `/change-email-otp/send`: max 3 requests per 60 seconds
- `/change-email-otp/verify`: max 3 requests per 60 seconds

## ❌ Error Codes

Available at:

```ts
import { changeEmailOTP } from "better-auth-change-email-otp-plugin";

changeEmailOTP.$ERROR_CODES;
```

Implemented codes:

- `OTP_EXPIRED`
- `INVALID_OTP`
- `TOO_MANY_ATTEMPTS`
- `EMAIL_ALREADY_EXISTS`

## 📝 Important Notes

- The plugin does not send emails by itself; you must implement `sendChangeEmailOTP`
- If OTP is requested multiple times for the same email, the previous OTP is replaced
- User authentication is required for both send and verify operations

## 📄 License

MIT
