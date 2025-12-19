# Better Auth Change Email OTP Plugin

Plugin for [Better Auth](https://www.better-auth.com/) that allows users to change their email address through OTP (One-Time Password) verification.

## 📋 Features

- ✅ Send OTP code for email change
- ✅ OTP verification with attempt limits
- ✅ Automatic code expiration
- ✅ Unique email validation
- ✅ Built-in rate limiting
- ✅ Full TypeScript support
- ✅ Better Auth integration

## 📦 Installation

```bash
npm install better-auth-change-email-otp
# or
pnpm add better-auth-change-email-otp
# or
yarn add better-auth-change-email-otp
```

### Required Dependencies

This plugin requires the following dependencies as peer dependencies:

- `better-auth`: `^1.4.5`
- `zod`: `^4.1.13`

Make sure you have them installed in your project.

## 🚀 Configuration

### 1. Server Configuration

Import and configure the plugin in your Better Auth configuration file:

```typescript
import { betterAuth } from "better-auth";
import { changeEmailOTP } from "better-auth-change-email-otp";

export const auth = betterAuth({
  // ... your Better Auth configuration
  plugins: [
    changeEmailOTP({
      // OTP options (optional)
      options: {
        length: 6,              // OTP code length (default: 6)
        expirationMinutes: 5,  // Minutes until expiration (default: 5)
        maxAttempts: 3,         // Maximum attempts before invalidation (default: 3)
      },
      // Required function to send the OTP
      sendChangeEmailOTP: async ({ email, otp }) => {
        // Implement your email sending logic here
        // For example, using nodemailer, Resend, SendGrid, etc.
        await sendEmail({
          to: email,
          subject: "Email change verification code",
          body: `Your verification code is: ${otp}`,
        });
      },
    }),
  ],
});
```

### 2. Client Configuration

Import the client plugin in your application:

```typescript
import { createAuthClient } from "better-auth/react"; // or the client you use
import { changeEmailOTPClient } from "better-auth-change-email-otp/client";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [changeEmailOTPClient()],
});
```

## 💻 Usage

### Send OTP Code

To request an OTP code to change the email:

```typescript
import { authClient } from "./auth-client";

// User must be authenticated
const result = await authClient.sendChangeEmailOTP({
  email: "new-email@example.com",
});

if (result.data?.success) {
  console.log("OTP code sent successfully");
}
```

### Verify OTP Code

To verify the OTP code and complete the email change:

```typescript
const result = await authClient.verifyChangeEmailOTP({
  email: "new-email@example.com",
  otp: "123456", // The code received via email
});

if (result.data?.success) {
  console.log("Email changed successfully");
}
```

## ⚙️ Configuration Options

The plugin accepts the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `length` | `number` | `6` | OTP code length |
| `expirationMinutes` | `number` | `5` | Minutes until the code expires |
| `maxAttempts` | `number` | `3` | Maximum number of attempts before invalidating the code |

### Custom Configuration Example

```typescript
changeEmailOTP({
  options: {
    length: 8,
    expirationMinutes: 10,
    maxAttempts: 5,
  },
  sendChangeEmailOTP: async ({ email, otp }) => {
    // Your implementation
  },
})
```

## 🔒 Security

- **Rate Limiting**: The plugin includes built-in rate limiting:
  - `/change-email-otp/send`: Maximum 3 requests per minute
  - `/change-email-otp/verify`: Maximum 3 requests per minute

- **Validations**:
  - User must be authenticated (session required)
  - New email cannot be in use by another user
  - OTP codes expire automatically
  - Attempt limit to prevent brute force attacks

## ❌ Error Handling

The plugin defines the following error codes:

```typescript
import { changeEmailOTP } from "better-auth-change-email-otp";

// Error codes are available at:
changeEmailOTP.$ERROR_CODES
```

Available error codes:

- `OTP_EXPIRED`: The OTP code has expired
- `INVALID_OTP`: The provided OTP code is invalid
- `TOO_MANY_ATTEMPTS`: Maximum attempts exceeded
- `EMAIL_ALREADY_EXISTS`: The email is already in use by another user

### Error Handling Example

```typescript
try {
  await authClient.verifyChangeEmailOTP({
    email: "new-email@example.com",
    otp: "123456",
  });
} catch (error) {
  if (error.message === "OTP expired") {
    // Code has expired, request a new one
  } else if (error.message === "Invalid OTP") {
    // Incorrect code
  } else if (error.message === "Too many attempts") {
    // Too many failed attempts
  } else if (error.message === "Email already exists") {
    // Email is already in use
  }
}
```

## 📝 Complete Example

### Server (Next.js API Route)

```typescript
// app/api/auth/[...all]/route.ts
import { betterAuth } from "better-auth";
import { changeEmailOTP } from "better-auth-change-email-otp";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: {
    // your database configuration
  },
  plugins: [
    changeEmailOTP({
      options: {
        length: 6,
        expirationMinutes: 5,
        maxAttempts: 3,
      },
      sendChangeEmailOTP: async ({ email, otp }) => {
        await resend.emails.send({
          from: "noreply@yourdomain.com",
          to: email,
          subject: "Verification code",
          html: `
            <h1>Verification Code</h1>
            <p>Your code to change your email is: <strong>${otp}</strong></p>
            <p>This code will expire in 5 minutes.</p>
          `,
        });
      },
    }),
  ],
});

export const { GET, POST } = auth.handler;
```

### Client (React)

```typescript
// components/ChangeEmailForm.tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ChangeEmailForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await authClient.sendChangeEmailOTP({ email });
      if (result.data?.success) {
        setStep("verify");
      }
    } catch (err: any) {
      setError(err.message || "Error sending code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await authClient.verifyChangeEmailOTP({ email, otp });
      if (result.data?.success) {
        alert("Email changed successfully");
        // Redirect or update UI
      }
    } catch (err: any) {
      setError(err.message || "Error verifying code");
    } finally {
      setLoading(false);
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={handleSendOTP}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="New email"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send code"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyOTP}>
      <p>Code sent to {email}</p>
      <input
        type="text"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="OTP code"
        maxLength={6}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Verifying..." : "Verify code"}
      </button>
      <button type="button" onClick={() => setStep("email")}>
        Change email
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
```

## 🔗 Endpoints

The plugin creates the following endpoints:

- `POST /change-email-otp/send` - Sends an OTP code to the new email
- `POST /change-email-otp/verify` - Verifies the OTP code and changes the email

## 📚 Resources

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth Plugins](https://www.better-auth.com/docs/plugins)

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome. Please open an issue or a pull request.
