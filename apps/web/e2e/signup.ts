import { expect, type Page } from "@playwright/test";

export async function signUpOwner(
  page: Page,
  input: { email: string; name: string; workspaceName: string },
) {
  const response = await page.request.post("/api/auth/signup", {
    data: {
      email: input.email,
      name: input.name,
      password: "playwright-password",
      workspaceName: input.workspaceName,
    },
  });
  expect(
    response.ok(),
    `Signup failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}
