# Visual overhaul — technical gate, 2026-10-03

Reviewed against frontend `a42a4d9b70f4d5f1d48eafa23697dcac27628dfe`.
The five Claude production-file diffs were read in full, including the structural
CSS rewrite. Fiscal calculations, Auth, service contracts and workflow commands
are unchanged. The natural-language payment date retains its year and uses UTC.
Removed selectors were checked against current markup; the old feed styling is
replaced by `.collaboration-item`. Dynamic badge classes are accounted for.

Preserved the paper/statement direction, navigation, surfaces, semantic palette,
entry motion and reduced-motion rules. Only three CSS corrections were needed:

- Open details replayed `tal-fade` three times during a 30-second background
  refresh. Removed that broad animation rule; navigation/dialog motion remains.
- A failed download displayed a green success check in the generic notification.
  Replaced the unconditional success icon with a neutral information icon.
- Generic paragraph rules overrode semantic badge colours in the next-payment
  and client-summary cards. Restricted only those colour declarations.

## Verification

| Check | Result |
| --- | --- |
| All SaaS unit/lifecycle/contract tests | 196/196 |
| Existing product UI browser suite | 8/8 |
| New presentation gate | 9/9 |
| Full frontend, serial run | 770/770 |
| Static frontend group | 310/310 |
| General responsive suite | 42/42 |
| Hosted development presentation smoke | 12/12 |
| Unchanged backend suite | 643 PASS, 260 skipped; one LIPE timeout, isolated retry 1/1 PASS |

The first concurrent frontend run passed 769/770: the unchanged public
Forfettario's Persona B test failed while entering amounts. Its isolated group
passed 4/4; the subsequent full serial run passed 770/770. These are recorded as
test-run instability, not hidden as initial successes or attributed to this CSS.

`node tools/forfettario-saas/test-support/visual-overhaul.e2e.mjs` starts a
loopback-only synthetic gallery, tests 15 routes and 22 additional states at
1440/1024/390/375, invoice/import/payment panels, keyboard/focus return, badge
contrast, motion/reduced motion, error notifications and overdue F24 warnings.
Screenshots go to the OS temporary directory, never the repository.

The hosted harness is `visual-overhaul-hosted.mjs`, with the configured local
preview on port 4173. It accepts a credentials object through stdin only
(`contribuente-b`, `s17c-workflow`, `studio-a-admin`, each with email/password).
For this review those existing synthetic credentials were read from Windows
Credential Manager and transferred in memory. No credentials, tokens, screenshots
or local configuration are committed. No admin credential is used by the harness.

Hosted journeys: contributor B's unlinked position, the S17C contributor and its
authorized Studio. Login, Oggi/client summary, Entrate, Tasse, Attività,
Dichiarazione and Pagamenti were checked at all four widths. The real activity
history includes sent, completed and requested-again documents. No new documents,
payments, confirmations or revocations were performed. Operational write RPCs and
PATCH/PUT/DELETE are blocked by the test. The S17C payment obligations are already
paid; the pending/overdue F24 panel is therefore exercised with local fixtures,
not claimed as a new hosted F24 generation or payment.

Manual browser inspection and screenshot review covered desktop/mobile layouts,
onboarding, partial/stale/denied states and the F24 panel. No horizontal overflow,
unhandled console error or missing resource was observed. This is browser
accessibility checking, not certification with a physical phone or screen reader.

## Deliberately outside this checkpoint

The long payment-verification form, invoice dates without a year, new charts and
new workflows remain untouched. Existing differences in the selected year between
income/fiscal views and the fixed PF 2026 declaration are not changed here.
Backend, Worker, public Forfettario, homepage/menu/sitemap and frontend main are
unchanged. No public deployment.
