import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { encrypt } from "../../src/lib/crypto";
import { withRlsContext } from "../../src/lib/rls";
import type { Session } from "../../src/lib/session-token";

const runStagingJourney = process.env.RUN_STAGING_E2E === "true";

test("public verification form shows an invalid-code result", async ({ page }) => {
  await page.goto("/verify");
  await page.getByLabel("Verification link or code").fill("invalid-test-code");
  const verificationResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/verify?token="),
  );
  await page.getByRole("button", { name: "Verify document" }).click();
  const response = await verificationResponse;
  expect(response.ok(), `Verification API returned HTTP ${response.status()}.`).toBeTruthy();
  await expect(page.getByText("Invalid / Forged Document")).toBeVisible();
  await expect(page.getByText("Invalid / Forged Document")).toBeVisible();
});

test("resident signs in, submits a request, and staff reviews it", async ({ browser }) => {
  test.skip(
    !runStagingJourney,
    "Set RUN_STAGING_E2E=true to opt in to synthetic writes on the confirmed non-production database.",
  );
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must point to the confirmed non-production database.");
  }

  const residentId = randomUUID();
  const staffId = randomUUID();
  const residentPassword = `Resident-${randomUUID()}-Strong!`;
  const staffPassword = `Staff-${randomUUID()}-Strong!`;
  const residentSession: Session = {
    userId: residentId,
    email: `e2e-${residentId}@example.test`,
    role: "RESIDENT",
  };
  const staffSession: Session = {
    userId: staffId,
    email: `e2e-${staffId}@example.test`,
    role: "STAFF",
  };
  const adminSession: Session = {
    userId: randomUUID(),
    email: "e2e-cleanup@example.test",
    role: "ADMIN",
  };
  const purpose = `E2E synthetic request ${randomUUID()}`;
  const residentPage = await browser.newPage();
  const staffPage = await browser.newPage();
  let usersCreated = false;

  try {
    const [residentHash, staffHash] = await Promise.all([
      bcrypt.hash(residentPassword, 12),
      bcrypt.hash(staffPassword, 12),
    ]);
    await withRlsContext(adminSession, async (tx) => {
      await tx.user.createMany({
        data: [
          {
            id: residentId,
            email: residentSession.email,
            passwordHash: residentHash,
            role: "RESIDENT",
            privacyNoticeAcceptedAt: new Date(),
            privacyNoticeVersion: "2026-10-v1",
          },
          {
            id: staffId,
            email: staffSession.email,
            passwordHash: staffHash,
            role: "STAFF",
          },
        ],
      });
    });
    usersCreated = true;
    await withRlsContext(residentSession, (tx) =>
      tx.residentProfile.create({
        data: {
          userId: residentId,
          fullNameEncrypted: encrypt("E2E Synthetic Resident"),
          dateOfBirthEncrypted: encrypt("1990-01-01"),
          addressEncrypted: encrypt("100 Synthetic Test Street"),
          phoneEncrypted: encrypt("0000000000"),
          civilStatusEncrypted: encrypt("Single"),
          firstNameEncrypted: encrypt("E2E"),
          lastNameEncrypted: encrypt("Synthetic"),
          houseNumberEncrypted: encrypt("100"),
          streetEncrypted: encrypt("Synthetic Test Street"),
          purokSitioEncrypted: encrypt("Test Purok"),
          barangayEncrypted: encrypt("Test Barangay"),
          cityMunicipalityEncrypted: encrypt("Test City"),
          provinceEncrypted: encrypt("Test Province"),
          postalCodeEncrypted: encrypt("0000"),
        },
      }),
    );

    const initialRequestApiCalls: string[] = [];
    residentPage.on("request", (request) => {
      if (request.url().includes("/api/v1/requests?page=0")) initialRequestApiCalls.push(request.url());
    });
    await residentPage.goto("/login");
    await residentPage.getByLabel("Email address").fill(residentSession.email);
    await residentPage.locator('input[autocomplete="current-password"]').fill(residentPassword);
    const loginResponse = residentPage.waitForResponse((response) =>
      response.url().endsWith("/api/v1/auth/login"),
    );
    await residentPage.getByRole("button", { name: "Sign in" }).click();
    const residentLoginResponse = await loginResponse;
    const residentLoginBody = await residentLoginResponse.json() as { error?: string };
    expect(
      residentLoginResponse.ok(),
      `Resident sign-in returned HTTP ${residentLoginResponse.status()}: ${residentLoginBody.error ?? "no error detail"}`,
    ).toBeTruthy();
    await expect(residentPage).toHaveURL(/\/$/);
    await expect(residentPage.getByRole("heading", { name: "Good day, E2E." })).toBeVisible();
    expect(initialRequestApiCalls).toHaveLength(0);
    await residentPage.getByRole("link", { name: "New request" }).click();
    await residentPage.getByLabel("Purpose of request").fill(purpose);
    await residentPage.getByRole("button", { name: "Submit request" }).click();
    const submissionNotice = residentPage.getByText(/Request BR-\d{4}-[A-F0-9]+ has been submitted\./);
    await expect(submissionNotice).toBeVisible();
    const referenceNo = (await submissionNotice.textContent())?.match(/BR-\d{4}-[A-F0-9]+/)?.[0];
    expect(referenceNo).toBeTruthy();

    const request = await withRlsContext(adminSession, (tx) =>
      tx.documentRequest.findUnique({ where: { referenceNo: referenceNo! }, select: { id: true } }),
    );
    expect(request).not.toBeNull();

    await staffPage.goto("/login");
    await staffPage.getByLabel("Email address").fill(staffSession.email);
    await staffPage.locator('input[autocomplete="current-password"]').fill(staffPassword);
    const staffLoginResponse = staffPage.waitForResponse((response) =>
      response.url().endsWith("/api/v1/auth/login"),
    );
    await staffPage.getByRole("button", { name: "Sign in" }).click();
    const staffLogin = await staffLoginResponse;
    expect(staffLogin.ok(), `Staff sign-in returned HTTP ${staffLogin.status()}.`).toBeTruthy();
    await expect(staffPage).toHaveURL(/\/staff$/);
    await staffPage.getByLabel("Search requests").fill(referenceNo!);
    await staffPage.getByRole("button", { name: new RegExp(referenceNo!) }).click();
    const reviewResponse = staffPage.waitForResponse((response) =>
      response.url().includes("/decision"),
    );
    await staffPage.getByRole("button", { name: "Start review" }).click();
    const reviewResult = await reviewResponse;
    const reviewBody = await reviewResult.json() as { error?: string };
    expect(
      reviewResult.ok(),
      `Starting request review returned HTTP ${reviewResult.status()}: ${reviewBody.error ?? "no error detail"}`,
    ).toBeTruthy();
    await expect(staffPage.getByText("Request moved into review.")).toBeVisible({ timeout: 15_000 });
    await staffPage.getByLabel(/Review note/).fill("Synthetic Playwright review.");
    const declineResponse = staffPage.waitForResponse((response) =>
      response.url().includes("/decision"),
    );
    await staffPage.getByRole("button", { name: "Decline", exact: true }).click();
    const declineResult = await declineResponse;
    const declineBody = await declineResult.json() as { error?: string };
    expect(
      declineResult.ok(),
      `Declining the request returned HTTP ${declineResult.status()}: ${declineBody.error ?? "no error detail"}`,
    ).toBeTruthy();
    await expect(staffPage.getByText("Request declined and resident notified in their portal.")).toBeVisible();
  } finally {
    await residentPage.close();
    await staffPage.close();
    if (usersCreated) {
      await withRlsContext(adminSession, async (tx) => {
        const requests = await tx.documentRequest.findMany({
          where: { residentId, purpose },
          select: { id: true },
        });
        const requestIds = requests.map((request) => request.id);
        if (requestIds.length) {
          await tx.auditLog.deleteMany({ where: { entityId: { in: requestIds } } });
          await tx.documentRequest.deleteMany({ where: { id: { in: requestIds } } });
        }
        await tx.auditLog.deleteMany({ where: { actorId: { in: [residentId, staffId] } } });
        await tx.user.deleteMany({ where: { id: { in: [residentId, staffId] } } });
      });
    }
  }
});
