import type { BetterAuthClientPlugin } from "better-auth";

import type { changeEmailOTP } from ".";

export const changeEmailOTPClient = () => {
  return {
    id: "change-email-otp",
    $InferServerPlugin: {} as ReturnType<typeof changeEmailOTP>,
  } satisfies BetterAuthClientPlugin;
};
