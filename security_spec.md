# Hyra Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. Every `tickets/{ticketId}` and `requests/{requestId}` document MUST have a valid `ownerUid` matching `request.auth.uid` on creation, and `ownerUid` + `createdAt` are strictly immutable on update.
2. All writes require verified authentication (`request.auth != null && request.auth.token.email_verified == true`).
3. Document IDs (`ticketId`, `requestId`) MUST match `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
4. All string fields enforce explicit `.size()` min/max bounds matching `firebase-blueprint.json`.
5. `createdAt` on create and `updatedAt` on update MUST equal `request.time`.
6. Terminal states (`status == 'resolved'` on tickets; `status in ['approved', 'declined']` on requests) lock non-admin updates.
7. List queries MUST evaluate `resource.data.ownerUid == request.auth.uid` or bootstrapped verified admin email without `get()`/`exists()` calls.
8. Non-admin users cannot approve or decline their own requests or self-assign into `/admins/{userId}`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Create**: Anonymous caller tries to create `/tickets/t1`. -> `PERMISSION_DENIED`
2. **Unverified Email Spoof**: Caller with admin email string but `email_verified: false` attempts list/update. -> `PERMISSION_DENIED`
3. **Identity Spoofing**: User A creates ticket with `ownerUid: "userB"`. -> `PERMISSION_DENIED`
4. **Shadow Field Injection**: Create ticket with extra ghost field `isVerified: true`. -> `PERMISSION_DENIED`
5. **ID Poisoning**: Create `/tickets/../../bad$id` or 200-char ID. -> `PERMISSION_DENIED`
6. **Resource Exhaustion**: Create ticket with 50KB `summary`. -> `PERMISSION_DENIED`
7. **Timestamp Forgery**: Create ticket with client backdated `createdAt`. -> `PERMISSION_DENIED`
8. **Immutable Field Tampering**: Update ticket changing `ownerUid` or `createdAt`. -> `PERMISSION_DENIED`
9. **Self-Approval Escalation**: Employee updates own `/requests/r1` setting `status: "approved"`. -> `PERMISSION_DENIED`
10. **Terminal State Bypass**: Non-admin updates already `resolved` ticket. -> `PERMISSION_DENIED`
11. **Value Poisoning**: Admin/owner updates `status` to invalid enum `"hacked"` or boolean `true`. -> `PERMISSION_DENIED`
12. **Admin Privilege Escalation**: Non-admin writes `/admins/{ownUid}`. -> `PERMISSION_DENIED`
