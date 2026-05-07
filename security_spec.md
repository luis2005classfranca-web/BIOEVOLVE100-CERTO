# Security Specification for BioEvolve

## Data Invariants
1. A user can only access their own health data (exams, wearables, insights).
2. Users cannot modify AI-generated insights once created (readonly for client, or system-generated).
3. `bioScore` is updated by the system or calculated based on data (users should not be able to set it arbitrarily, although current app code does some updates).
4. Immutability of key fields like `userId`.

## The "Dirty Dozen" Payloads
1. **Identity Theft**: Authenticated User A tries to read `users/UserB/exams`.
2. **Orphaned Exam**: Writing an exam without a date or analyte.
3. **Ghost Field**: Adding `isAdmin: true` to a user profile.
4. **Denial of Wallet**: Sending a 1MB string in the `analyte` field.
5. **Privilege Escalation**: User A trying to update User A's profile with a high `bioScore` manually.
6. **State Shortcut**: Updating `onboardingComplete` without providing age/weight.
7. **Future Dating**: Setting `createdAt` to a future date.
8. **ID Poisoning**: Using a 10KB string as an `examId`.
9. **PII Leak**: Unauthenticated read of `users/UserA/profile/initial`.
10. **Query Scraping**: Authenticated user trying to list ALL exams from the `exams` collection group.
11. **Shadow Update**: Updating an exam with a hidden field `verified: true`.
12. **Immutable Violation**: Trying to change the `date` of an existing exam.

## Test Runner (Logic)
The following rules will be tested against these payloads to ensure `PERMISSION_DENIED`.
