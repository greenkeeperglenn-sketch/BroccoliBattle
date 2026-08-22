import { describe, expect, it } from "vitest";
import {
  bindManagementInvite,
  bindMemberInvite,
  getSessionMember,
  issueMemberInvite,
} from "@/lib/auth/sessions";
import { createWorld } from "./helpers";
import { memberInvites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/auth/tokens";

describe("member invite binding", () => {
  it("binds a session from a valid invite and identifies the member", async () => {
    const world = await createWorld();
    const link = world.setup.memberLinks.find((l) => l.name === "Cerys")!;

    const bound = await bindMemberInvite(world.db, link.token);
    expect(bound).not.toBeNull();
    expect(bound!.member.displayName).toBe("Cerys");

    const session = await getSessionMember(world.db, bound!.sessionToken);
    expect(session?.member.displayName).toBe("Cerys");
    expect(session?.household.name).toBe("Broccoli Battle");
  });

  it("rejects an invalid token", async () => {
    const world = await createWorld();
    expect(await bindMemberInvite(world.db, "not-a-real-token")).toBeNull();
    expect(await getSessionMember(world.db, "fake-session")).toBeNull();
  });

  it("stores only token hashes, never plaintext", async () => {
    const world = await createWorld();
    const link = world.setup.memberLinks[0];
    const rows = await world.db.select().from(memberInvites);
    expect(rows.some((r) => r.tokenHash === link.token)).toBe(false);
    expect(rows.some((r) => r.tokenHash === hashToken(link.token))).toBe(true);
  });

  it("a reused invite binds a second device; a revoked one does not", async () => {
    const world = await createWorld();
    const link = world.setup.memberLinks[0];
    expect(await bindMemberInvite(world.db, link.token)).not.toBeNull();
    expect(await bindMemberInvite(world.db, link.token)).not.toBeNull();

    // Rotate with revocation.
    const member = world.members.find((m) => m.id === link.memberId)!;
    const newToken = await issueMemberInvite(world.db, member.id, {
      revokeExisting: true,
    });
    expect(await bindMemberInvite(world.db, link.token)).toBeNull();
    expect(await bindMemberInvite(world.db, newToken)).not.toBeNull();
  });

  it("management invite binds a management session", async () => {
    const world = await createWorld();
    const bound = await bindManagementInvite(
      world.db,
      world.setup.managementToken,
    );
    expect(bound?.household.id).toBe(world.household.id);
  });
});
