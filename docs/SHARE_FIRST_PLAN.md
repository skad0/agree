# Problem-first sharing: consolidated plan

Date: 2026-09-19. Status: implementation-ready planning contract, including resolved UI/UX decisions, route behavior, content catalog, and data-publication design. Application changes have not started; accessibility and usability of the proposed implementation remain to be verified.

## Implementation brief

Read this brief, then only the detailed sections relevant to the current slice. The rest of this document is reference material, not context to reload on every coding turn.

- **Keep:** Hono SSR, SQLite, existing canonical clauses/locales, CSP, themes, historical read links, privacy/deletion, and admin protections.
- **Public product:** ten equal problem cards → stable issue page or inline Share → named social destination. Candidates are a secondary read-only directory. No campaign mail, signup, message editing, reply intake, or share tracking.
- **Interaction:** one ShareOptions component; Share always expands native details. Copy has truthful live feedback; More apps is progressive enhancement. Header is Problems/Candidates/About, wrapping at narrow widths. No hidden horizontal navigation.
- **URLs/content:** ten fixed slugs mapped to verified demand IDs; use the catalog below. Canonical summaries feed cards, social text, and metadata. Candidate filters use explicit server-rendered forms. Follow the exact route table for legacy links and all nine retired POST routes.
- **Candidate data:** retain the local full-name transcript format; add immutable snapshot metadata/list versions. Directory reads the active snapshot directly, without creating/deactivating recipient contacts. Approval requires official evidence and remains separate from activation.
- **Integration:** preserve uncommitted work first; use main plus the checkpoint as the baseline. Selectively adapt PR #7; leave unrelated branches and PR #1 out of the core changes.
- **Order:** (1) share-first UI/compatibility, (2) candidate consolidation/refresh, (3) content and release verification. UI can work with no candidate publication.
- **Done means evidence:** typecheck/tests/smoke plus the browser/accessibility matrix. Translation review, assistive-technology tests, and source approval are never inferred. This planning task does not deploy or activate data.

Planning consistency checks passed: all ten catalog IDs/slugs match the current local seeded standard, and all nine request POST routes are covered by the retirement contract. These are specification checks, not implementation test results.

## Product decision

The user confirmed **problem-first sharing, with candidates optional**, and the target election is **Israel's 26th Knesset**. The primary experience becomes:

**See a problem → understand the proposed commitment → share its public page.**

No recipient selection, email, signup, letter builder, personal information, or delivery confirmation is required. Visitors edit their own commentary in the social application, keeping the first release free of an on-site personal-text editor.

This plan takes precedence for the proposed next release over the ask-first journey in `docs/main-page-redesign-strategy/IMPLEMENTATION_PLAN.md` and the retained letter workflow in `docs/ACTION_ONLY_PRIVACY_PLAN.md`. Their privacy, accessibility, CSP, compatibility, and operational safeguards still apply. The change simplifies presentation of the canonical commitments; it does not silently rewrite their political substance.

## Verified project state

| Area | Finding on September 19 |
| --- | --- |
| Main | Local `main` and refreshed `origin/main` are `ca7f69c`. Hono JSX SSR, native forms, TypeScript, SQLite WAL, one Render instance. No framework replacement is needed. |
| Working directory | Pre-existing uncommitted import work: 18 modified tracked files plus candidate JSON, migration 020, importer, and importer tests. Preserve this before integration. None of it was changed during this audit. |
| Local checks | Node 24.18.0; `npm run typecheck` passed; `npm test` passed all 113 tests; compiled `scripts/pages-smoke.js` passed representative routes, all seven locale homes, expected disabled support routes, and protected admin. Checks cover the current working directory, not an independent PR checkout. |
| Live public UI | `https://rafmeshutaf.org.il/en` is reachable and still leads with “Write an appeal” and “Submit a reply.” The English directory has one result, “Public Service Office”; the Hebrew directory has 90. Both say an approved election list is not yet published there. |
| Live verification limit | Public pages were inspected read-only. Production commit, database contents, configuration, deployment logs, and admin were not inspected. The browser blocked `/health`; local health passed. This is not a production infrastructure audit. |
| Social sharing | Existing X/Facebook/WhatsApp/Telegram links and clipboard support are reusable. Sharing is buried behind recipient/build/preview/action screens. Preview requires a contactable recipient plus email, WhatsApp, and social templates. |
| Share URLs | Current links use generated-request result records and can expire through the existing 12-calendar-month retention path. Result pages have text metadata, but no `og:image`; home and documents do not receive that share metadata. |
| Data visibility | The local changes add Hebrew-name fallback and list rank. Main's locale-specific name join explains the observed locale disparity; production database details remain unverified. |
| Content and operations | Seven locales and RTL support already exist. Translation review remains outstanding. Historical documents disagree about the current journey; README also says there are no webfonts although Amharic fonts are served. Update current contracts and label old plans as historical. |

### Branch disposition

Remote references and PR states were refreshed through GitHub. This is a scoped branch audit, not approval to merge, close, delete, or reset anything.

| Branch / PR | Relationship and recommendation |
| --- | --- |
| `origin/cursor_recipient-discovery-slice6-61d7`, [PR #7](https://github.com/skad0/agree/pull/7), `b1d6589` | Open; 5 commits ahead of main, none behind. Directory publication/affiliations, alternate CEC importer, party-email fallback, privacy contact changes. Overlaps local import work. Reconcile selected pieces explicitly; do not merge both import paths. Defer party-email fallback in the share-only release. Review privacy changes independently. |
| `skad0-production-run-guide`, [PR #1](https://github.com/skad0/agree/pull/1), `3aa4e0b` | Open; 2 commits ahead / 9 behind main. Terms, accessibility, corrections pages and Windows build changes. Main already has a working Windows build; rebase or selectively port only missing informational pages, with reviewed copy. Not a prerequisite for implementing sharing. |
| `feat/election-directory-slice1` through `slice5` | PRs #2–#6 are merged. Do not re-merge these branch tips: history includes squash integration and later main changes. Archive/remove only after ordinary branch hygiene review. |
| `pr-2-review` | Review pointer to slice 1. No new product work to carry forward. |
| `arena/abyssus-b`, `skad0-fictional-robot` | Point to `e3254ae`, the redesign already in main. No additional implementation to adopt. |
| `arena/abyssus-a`, `arena/abyssus-c`, `arena/abyssus-d` | Divergent standalone Abyssus viewers, unrelated to this civic product. Exclude from integration. Worktrees exist; do not delete or disturb them. |
| `arena/abyssus-viewer-a` | Ancestor of main, 31 commits behind. Historical only. |

Several branches have active worktrees. Their uncommitted contents were not audited; branch age alone is not grounds for deletion.

## Candidate status: submitted is not approved

The [official CEC candidate index](https://www.gov.il/he/pages/candidates-lists-26), inspected in a browser on September 19 and displaying an update date of September 18, explicitly says the lists are not final and the committee has not yet approved them. **An approved roster cannot truthfully be published from the evidence available today.**

The local `data/elections/knesset-26-lists.json` was retrieved September 13 and records 38 submitted lists, 1,258 candidate rows, and three lists without rosters. The current index links all three previously missing lists:

- [Likud](https://www.gov.il/he/pages/halikud-tikvahadasha_iist29): roster content was opened and verified.
- [Hashutafut Lekulam](https://www.gov.il/he/pages/hashutafut-lekulam_iist): link verified on the index; roster contents require refresh validation.
- [Shema](https://www.gov.il/he/pages/shama): link verified on the index; roster contents require refresh validation.

The recorded 1,258 is the local snapshot count, not a claim about today's complete total. Re-fetch/review all source rosters and compare counts, names, ranks, titles, and ballot letters. Do not merely append three lists or change the existing status to approved.

Recommended display now: **“Submitted candidate lists — awaiting CEC approval”**, with source, source update date, checked date, and coverage. When official approval is published, ingest it as a separate dated snapshot and activate after validation. A manual operator refresh is sufficient for this release; no scheduler, new feed integration, or background monitoring is required.

## Proposed public experience

### Home

Use a short explanation and a visible grid of the ten existing standard commitments, written as plain-language questions. Keep their existing canonical order; no popularity ranking. Use the complete catalog below. Each card contains its numbered heading as the only detail-page link, a short explanation, and a directly available Share disclosure. Do not add a duplicate Read more link. Full document text stays on its existing document page.

Public navigation: **Problems · Candidates · About**, language picker, theme control. The full standard, coalition agreement, 100-day plan, methodology, privacy, and informational pages remain accessible as supporting material. Remove the numbered write/reply journey.

### One durable page per problem

Use `/:locale/issues/:slug`, with the explicit mapping below from stable slugs to existing standard demand IDs. Reuse `demand_translations` fields for commitment, rationale, verification, and exceptions. Put new short headings and share summaries in reviewed locale content; avoid a second issue-content database or generic CMS.

The page contains:

1. A clear problem/question heading and one short explanation.
2. The existing proposed commitment, with the rationale visible.
3. One primary Share disclosure that expands inline; Copy link and named social alternatives inside it.
4. Expandable “How it can be checked” and “Exceptions,” and a link to the full standard.
5. An optional link to explore candidate lists. Reading or sharing requires no candidate selection.

Every shared link returns the reader to the same problem and offers the same share action. It is an ordinary public GET page, requiring no generated request, visitor-specific identifier, CSRF token, captcha, or database write. Language switching preserves the issue slug. Unsupported slugs return a localized 404; disabled campaign behavior remains explicit and tested.

### Share behavior

- Make **Share** a native inline `<details>/<summary>` disclosure on every device, including without JavaScript. It always reveals the same short text, selectable URL, and named WhatsApp, Facebook, Telegram, and X links in the same order. Add Copy link when its handler is ready and **More apps** when native sharing is supported. More apps invokes the device share sheet directly from that click. Do not make the same Share label open a native sheet on one device and silently copy on another. OS-provided share targets are outside the site's control; the site itself supplies no email action.
- Use short canonical text and one absolute issue URL. Keep long explanations on the page. No recipient handle is needed, and no on-site personal draft is collected.
- Facebook's existing URL-only behavior remains the baseline. Make copying the short text optional rather than a prerequisite to sharing the link.
- Native share cancellation is normal. Failures expose usable fallback links; clipboard failure leaves a selectable URL. Never claim a post was published or a candidate received it.
- The non-JavaScript page retains ordinary social links and selectable copy text. No modal or multi-step wizard is needed.
- Add server-rendered canonical, Open Graph, and social-card metadata to home and every issue page. Supply same-origin versioned PNG/JPEG preview assets and alt text. Start with one accurate branded preview per locale; topic-specific images can follow. No runtime image-generation service is needed.
- Images and metadata must be retrievable without auth or cookies. Verify actual preview rendering before release; platform caches mean rendering is not guaranteed by tags alone.

Reference: [Web Share specification](https://www.w3.org/TR/web-share/) and [Open Graph protocol](https://ogp.me/). Feature detection and fallbacks are required; a share API result is not proof of publication.

### Candidate directory

Make `/:locale/candidates` a secondary, read-only directory. Browse all officially sourced candidates even when no contact channel exists. Show list, official rank, original Hebrew name with correct bidi isolation, approval status, and provenance. Search and list filtering remain useful; remove contactability, message baskets, and sequential sending from this surface.

Scope the current election directory to the selected published snapshot. Historical officeholders and the “Public Service Office” seed must not be presented as current approved candidates. Keep records needed for historical links; exclusion from the current directory does not mean deletion.

Do not infer constituent-party membership from a joint electoral list, infer personal positions from party positions, or treat missing evidence as opposition. Preserve existing reviewed stance data internally; comparative stance widgets are unnecessary for this first simplified release.

Optional candidate-specific share text is deferred. If added later, it must have a stable, snapshot-aware public identity and must work without an email or WhatsApp address.

## Consolidated UI/UX and accessibility contract

This section resolves the previously unspecified interaction details above. It is the implementation contract, not a claim that the current live site meets it. Target WCAG 2.2 AA across the shipped public surfaces; automated checks alone cannot establish conformance.

### Review evidence and gaps

On September 19, the live English and Hebrew homepages were inspected at a 320 × 800 browser viewport, alongside `src/layout.tsx`, `src/assets.ts`, and the public components.

| Finding | Evidence / conclusion |
| --- | --- |
| Navigation hides destinations on small screens | English primary navigation measured 405px of scrollable content inside 273px; Hebrew measured 291px inside 273px. Screenshots show clipped links. CSS suppresses the scrollbar. Replace with the three wrapping navigation links; never require discovering an invisible horizontal scroller. |
| Current-page navigation is not explicit | No `aria-current="page"` link was present in the inspected main navigation; source does not set it. The new three-link navigation must identify the current section visually and programmatically. |
| Copy feedback is incomplete | The source clipboard handler provides no visible or live-region success message. Existing form fallback can submit an old request action; it must not be reused unchanged for read-only sharing. |
| Existing foundations are useful | Live pages expose a skip link, main landmark, page heading, language disclosure, and named links. Source provides visible focus styling, public touch-target sizing, and reduced-motion handling. These are foundations to verify, not a blanket accessibility pass. |
| Narrow page width and RTL | Neither inspected home had whole-page horizontal overflow at 320px. Hebrew reported `lang=he`, `dir=rtl`; screenshot order matched RTL. This does not verify other pages, text spacing, 200% text resize, or 400% browser zoom. |
| Skip link needs completion testing | Tab reached the skip link and Enter navigated to `#content`; DOM focus remained on BODY. Verify subsequent keyboard and screen-reader reading position, and make the main target programmatically focusable if needed. A changed URL hash alone is insufficient evidence. |
| Proposed flow is unbuilt | Native sharing, issue pages, new navigation, translated summaries, assistive-technology behavior, and social previews cannot yet receive an implementation pass. |

### One interaction vocabulary and component set

Reuse one public shell, one issue-card pattern, one issue-detail pattern, one ShareOptions component, and one status-message pattern. Avoid duplicating share behavior in home, issue, and historical-result routes. Adapt legacy records into the common controls only where their read-only semantics match.

| Element | Predictable behavior |
| --- | --- |
| Wordmark / Problems | Goes to the localized home/problem index. The issue detail page marks Problems as the current section and provides a visible “All problems” link. |
| Problem heading | The heading is the single descriptive detail-page link and opens in the same tab. Do not make the whole card clickable around nested controls or add a duplicate Read more link. |
| Share | Expands/collapses options in place. It does not navigate, copy, submit, or post. Accessible name includes the issue heading while retaining the visible word Share. Disclosure state is announced natively. |
| Social platform link | Opens the named external platform through an ordinary link, without a forced popup/new tab. A nearby note says the platform opens and the visitor chooses whether to post. App/browser handoff is platform-controlled; do not promise automatic return. |
| More apps | Opens the native share sheet, where supported. On return or cancellation, keep the issue and expanded options available; preserve or restore focus to the invoking control when the browser allows it. |
| Copy link | Copies only the shown canonical URL. A nearby `role="status"` announces “Link copied” after success. Failure says “Could not copy automatically. Select and copy this link” and leaves the URL available. Never announce success on failure or move focus for success. |
| Language | Opens the endonym list; choosing a language navigates only on activation. Preserve issue identity. In the candidate directory preserve validated search/list filters; retain original names if no translation exists. Explain any unavailable filter or untranslated content. |
| Candidate filters | Labeled search input, native list selector, Search, and Clear filters. Submit explicitly; no auto-navigation on selection, mandatory autocomplete, or focus movement while typing. Preserve filter state in validated public query parameters and pagination links; never treat those as appeal text. |
| Clear filters / Back | Clear returns to the unfiltered directory; browser Back returns to the previous URL/filter state. Do not replace navigation history on every keystroke. Preserve native history/scroll restoration where supported. |
| Supporting-detail disclosures | Native details/summary with specific “How it can be checked” and “Exceptions” labels; essential problem and commitment remain outside collapsed content. No hover-only explanation or gesture-only action. |

Place the primary navigation, language control, issue actions, provenance, and footer in consistent positions. Main navigation wraps on small screens and uses text labels, not icon-only or color-only meanings. The ten issues use one canonical order and equal visual treatment. The first issue content must follow a brief introduction, without intervening document catalogs or another numbered journey.

Use one-column cards on narrow screens, natural text wrapping, and no fixed-height text containers. Problem heading: usually one short sentence; summary: one or two sentences. These are editorial targets, not truncation limits. Preserve complete translations and candidate names. Use “Problem” for the concern, “Proposed commitment” for the project's request, and “Official status” for sourced election facts so readers can distinguish them.

### Complete state behavior

| State | Required response |
| --- | --- |
| Share options closed/open | Same layout and labels everywhere; summary remains the toggle. No focus trap or whole-page modal. |
| Native share cancelled | No error banner, retry loop, completion page, or “posted” claim; leave the user where they were. |
| Native share unavailable/fails | Named platform links and manual copy remain usable. An actual failure gets a brief local status message; unsupported devices simply omit More apps. |
| JavaScript absent/failed | Issue content, Share disclosure, external links, selectable URL, language links, and directory forms still work. Hide enhancement-only buttons until their handlers are ready. |
| No matching candidates | Distinguish “No matches for these filters” from “Candidate data is not available”; provide Clear filters and Problems links. Never suggest zero candidates are running. |
| No verified publication / partial roster | State unavailability or incomplete coverage with checked date and official source. Issue sharing remains available. |
| Submitted / approved / unknown | Separate text labels with provenance; no green/red-only distinction or inferred approval. |
| Missing translation | Clearly identify source-language text with appropriate `lang` and direction. Never silently place English paragraphs beneath another locale's label. |
| Old link or retired form | Explain that the workflow changed and offer the relevant issue/directory destination. No unexplained dead end or redirect into a mail builder. |
| Campaign disabled / invalid issue | Preserve appropriate HTTP status and localized explanation; show only links that remain available under that state. No enabled-looking button to a known disabled action. |

### Measurable accessibility requirements

- Semantic landmarks, one descriptive H1, ordered section headings, visible labels, meaningful link names, and native button/link/disclosure behavior. Repeated Share controls include their issue context in the accessible name. Decorative icons are hidden from assistive technology.
- All actions work with Tab/Shift+Tab, Enter, and Space as appropriate. Logical DOM order matches visual reading order in LTR/RTL; do not use CSS ordering to reverse keyboard order. A visible focus indicator is never clipped or covered. Skip navigation must place subsequent navigation at main content.
- Project touch-target goal: at least **44 × 44 CSS px** for primary controls, share destinations, navigation, and filter controls. This exceeds WCAG 2.2 AA's 24px minimum/spacing rule; inline prose links have the standard's exceptions. Do not describe 44px as an AA requirement.
- Test reflow at **320 CSS px** and actual **400% browser zoom at 1280px**, plus 200% text resizing and WCAG text-spacing overrides. No loss, overlapping controls, clipped labels, or horizontal scrolling for ordinary content/navigation. A narrow viewport test alone does not cover every zoom behavior.
- Measure rendered light/dark text contrast: at least 4.5:1 for normal text and 3:1 for large text; meaningful control boundaries and state indicators meet applicable 3:1 non-text contrast. Check focus, hover, muted text, source dates, and disabled explanations, not only design-token pairs. Support forced colors and reduced motion.
- Announce copy feedback and asynchronously changed result counts politely, without reading the entire directory or stealing focus. Normal server navigation should provide a meaningful title/H1 rather than a competing unnecessary live announcement.
- Set page language/direction; isolate Hebrew names, URLs, numbers, and mixed-script metadata appropriately. Hebrew fallback names receive `lang="he"`; list labels and source-language passages need the same care. Keep icons from becoming the sole direction cue.
- Do not block browser zoom, require dragging/swiping, introduce time limits, or convey commitments only through preview images. The public HTML contains the complete readable content.

References: W3C [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), and [consistent identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html). These checks complement the full WCAG 2.2 AA assessment; they are not its complete criterion list.

### Verification and sign-off

Record pass/fail/not-tested with browser, viewport, locale, and evidence. Never convert a plan requirement or passing Node test into a browser-accessibility pass.

| Check | Acceptance / evidence required | Current status |
| --- | --- | --- |
| Consistent journey | Home → Share → named destination takes two site-control activations, excluding scrolling and the external platform's controls. Read more → Share → destination is three. More apps adds the OS's own choices. No email, candidate, captcha, or signup prerequisite. | Specified; not implemented |
| Keyboard | Complete issue reading, disclosure, copy/fallback, language change, search/filter/reset/pagination, and return navigation without a pointer or lost focus. | Pending implementation |
| Screen reader | Test NVDA with a supported desktop browser and VoiceOver on mobile Safari (or document the actual supported assistive-technology matrix). Verify names, roles, states, reading order, live feedback, and mixed-script pronunciation. AX-tree inspection alone is not this test. | Not tested |
| Responsive and visual | English/Hebrew at 320, 390, 768, and 1280px; all seven locales at narrow/desktop widths; zoom/text spacing, light/dark, forced colors, reduced motion. | Current home spot-check only; new UI pending |
| Automation | Run an accessibility scanner on home, issue, directory normal/empty, and legacy/unavailable states. Resolve serious/critical findings and document all remaining findings; supplement with manual checks. | Not run |
| Share resilience | Successful/failed clipboard, unsupported/cancelled/failed native sharing, JavaScript disabled, external back navigation, and anonymously fetched metadata/image. Do not post during automated checks. | Pending implementation |
| Understandability | Ask 3–5 representative readers, including Hebrew/RTL and keyboard or screen-reader users, to find a problem, explain its commitment, share/copy its link, return, and identify whether a candidate list is approved. Aim for unassisted completion by all participants; fix any recurring confusion and retest. This is formative feedback, not statistical proof. | Not conducted |

The design is consolidated when the same actions have the same names and behavior on every surface. The implementation is ready for accessibility/UX sign-off only after the above evidence exists and remaining limitations are explicit.

## Resolved implementation details

### Complete issue catalog and content ownership

The current seeded standard has demand IDs 1–10 in canonical order. The following explicit mapping is the first-release catalog. At implementation, verify each ID against the active campaign and `document='standard'`; do not infer identity from a translated title or silently remap a missing ID to a different clause. Keep slugs stable across languages and title edits. Future campaign replacement requires an explicit mapping/redirect decision, not automatic reuse of an old slug for a new meaning.

All wording below is an **editorial draft**, derived from the existing commitments. It does not claim any party has adopted them and does not certify current law. Newly written summaries require review even in Russian; the authoritative Russian package remains the source for substance.

| ID | Stable slug | English question / card heading | English short summary / share text |
| --- | --- | --- | --- |
| 1 | `elections-on-time` | Will elections be held on time? | Ask parties to commit to elections on schedule, with any extension limited to the exceptional conditions in the full standard. |
| 2 | `election-results` | Will parties respect the election result? | Ask parties to accept official results, use lawful appeal procedures, and commit to a peaceful transfer of power. |
| 3 | `court-rulings` | Will the government comply with final court rulings? | Ask parties to commit to complying with final court rulings while using lawful routes to challenge them. |
| 4 | `coalition-choices` | Which coalitions could my vote support? | Ask parties to publish their possible coalition partners, outside-support arrangements, and conditions before the election. |
| 5 | `government-size` | How large will the government be? | The project proposes a voluntary limit of 18 ministers, including the prime minister, and four deputies. Ask parties to state their commitment. |
| 6 | `ministerial-responsibility` | What will each minister be responsible for? | Ask parties to give every minister defined responsibilities, powers, and published objectives. |
| 7 | `first-100-days` | What will happen in the first 100 days? | Ask parties to publish specific actions, deadlines, responsibilities, and completion criteria before the election. |
| 8 | `october-7-inquiry` | How will the failures of 7 October be investigated? | Ask parties to commit to establishing a state commission of inquiry. The full standard explains the proposed process and deadline. |
| 9 | `professional-security-services` | How will security services stay free of party interests? | Ask parties to safeguard professional policing and security services while preserving lawful civilian oversight. |
| 10 | `public-agreements` | What agreements and spending commitments will be public? | Ask parties to publish coalition agreements, related appointments, budget commitments, and funding sources. |

Home H1 draft: **“Know what you are voting for.”** Intro: “Explore ten questions parties should answer before the election. Read the proposed commitments and share the issues that matter to you.” Brief neutrality note: “The project does not recommend a party or candidate.” Avoid “Every party receives these questions,” which implies delivery.

Put headings/summaries under one consistent key family, `issue.<slug>.title` / `issue.<slug>.summary`, in the existing locale dictionaries. The mapping file contains IDs and slugs only. Share text, card summaries, and issue metadata use the same reviewed summary; there are no independently drifting copies. The detailed body retains its existing localized database fields and canonical versioning.

During development, visibly label unreviewed copy in the review artifact. Before public release, record reviewer, locale, affected keys, source version, date, and outcome in `docs/TRANSLATION-REVIEW.md`. Missing political text must be shown as explicitly labeled source-language content or a localized unavailable state with a source link, never as untranslated key names. The release target remains all seven locales; do not quietly drop a language to pass a check.

### Screen composition and shared document behavior

| Screen | Final content order |
| --- | --- |
| Home | Shared header → H1/brief intro/neutrality note → ten equal issue cards → “Read the full standard” → shared footer. No second document catalog, journey strip, counter, or mail CTA before the cards. |
| Issue detail | All problems link → H1 → short summary → “Proposed commitment” with full body → Share disclosure → rationale → separate verification and exceptions disclosures → full-standard clause anchor → optional candidate-directory link → footer. Omit empty optional fields rather than empty disclosures. |
| Candidates | H1 → official status/source/check date/coverage → labeled search and list filter → result summary → candidate rows → Previous/Next pagination → footer. The page always has a way back to Problems. |
| Full standard | Existing clause content and anchors → per-clause link to the corresponding issue. Replace `AskPanel` with a simple Problems link; do not embed ten more mail or share workflows. |
| Coalition, 100 days, government model | Keep content and current URLs; replace every AskPanel with a Problems link. No redesign of timelines or portfolios in this release. |
| About/methodology/privacy | Update prose to match actual sharing and retained historical-data behavior; use the same public shell. Keep protected admin chrome separate. |

One column below 48rem and two issue-card columns above it; cap the content width using the existing wrap tokens. Keep DOM order identical at both sizes. An expanded Share panel grows its own card naturally, without closing another panel or moving focus. Do not add a sticky bottom toolbar, carousel, full-card link, automatic scrolling, modal, or icon-only menu.

Footer order: full standard, coalition agreement, 100 days, government model, methodology, privacy, then available accessibility/corrections pages and appearance controls. Use wrapping layout; do not render links to pages that have not been implemented. Header and footer placement remain identical across public routes, including paused and error pages.

### Exact route and response contract

| Route | Behavior |
| --- | --- |
| `GET /` | Existing locale negotiation redirect. An explicitly localized issue URL never redirects based on browser language. |
| `GET /:locale` | 200 issue index for an active campaign; no generated-request or action write. |
| `GET /:locale/issues/:slug` | 200 for the mapped active standard clause; 404 for unknown/unavailable clause; 503 if the campaign is paused. Localized state page offers appropriate available destinations. |
| `GET /:locale/candidates` | 200 for published data or an honest empty/partial state. No publication is not a server error. Real database/service failure is 503, never an empty success. |
| `GET /:locale/request` and `/request/build` | 302: valid `demand` takes precedence and maps to its issue; otherwise a recognized recipient goes to Candidates with a brief “Appeals have been replaced by issue sharing” notice; otherwise home. Use a fixed allowlisted notice code, not arbitrary query text. Ignore obsolete basket/message fields. |
| `POST /:locale/request`, `/request/selection`, `/request/review`, `/request/build`, `/request/suggest`, `/request/preview`, `/request/action`, `/request/copy`, `/request/report-sent` | 410 localized retired-flow response, with no body echo, inserts, action records, email, or redirects that replay POST data. `/request/suggest` returns its structured unavailable response with status 410. Remove old client hooks pointing to it. Keep perimeter/body-size protections. |
| `GET /:locale/request/result?request=…` | Preserve current random-ID validation, 404 for missing/expired records, private/no-store, no personal text, and read-only result content. Render requested UI locale while labeling any source-language fallback. Preserve `request` through language changes. Existing delivery claims and resume-send buttons are removed. |
| `GET /:locale/responses/new`; `POST /:locale/responses` | 503/no-store paused-intake explanation; POST performs no submission/upload. “New reply submissions are paused. You can still explore and share the issues.” Admin access and existing records remain. |
| `GET /:locale/responses/thanks` | Informational historical endpoint; never assert a new submission succeeded merely because this URL was opened. |
| Support and `/verify-email` | Signup remains disabled; preserve appropriate handling of already-issued historical verification links. No public CTA or admin toggle can accidentally restore the retired campaign-send workflow. |
| Privacy/delete, documents, `/demands`, assets, `/health`, admin | Preserve existing route/security contracts except explicitly documented public-copy and navigation changes. Privacy/deletion remain reachable during campaign pauses. |

For this release, `campaign.status` controls the new public issue/directory experience. Legacy `requests_enabled` does not gate read-only issue sharing. Admin labels must explain that requests/responses settings govern legacy behavior; this build keeps retired writes unavailable regardless of those old settings. Use the existing campaign pause for emergency withdrawal; do not add new share-tracking controls.

### URLs, indexing, caching, and share assets

Issue URLs contain only locale and slug. Canonical/OG URLs come from validated `APP_BASE_URL`, never the request Host or user-supplied URL. Strip `lang=1`, notice codes, tracking, and arbitrary query parameters from shared/canonical URLs. No fragment is needed for the issue page itself. Render language alternates for supported issue URLs; do not advertise a translated page whose content is unavailable as fully translated.

Keep `publicCache()` behavior for successful public content. Language preference responses carrying Set-Cookie remain private/no-store. Directory pages with search/filter queries are private/no-store and noindex; the unfiltered directory may use ordinary public caching. Historical results stay private/no-store and noindex. Preview assets have versioned paths and immutable caching. Campaign pause takes effect within the existing 60-second edge cache lifetime, or immediately after an operator purges that cache; do not promise instant withdrawal otherwise.

Use one deterministic **1200 × 630 PNG per locale**, with the existing brand palette, project name, and a short translated “Questions before the vote” label. Keep meaningful text away from edges, do not include candidate portraits, and keep each image below 300KB as a project performance target. Produce these at build/design time, verify Hebrew/Arabic shaping and Amharic glyphs, and commit the assets. No per-visitor image generation, external image host, or runtime rendering dependency. Set `og:image`, dimensions, type, alt text, and `twitter:card=summary_large_image`. The page-specific title/description carry the issue's meaning; the generic brand image must not pretend to be an issue-specific graphic.

Platform adapters take a shared `{title, text, url}` object and encode each value once. WhatsApp/X include one URL in the composed text, Telegram supplies the URL separately from text, and Facebook gets the URL only. For X, use the short issue title plus URL if the full summary does not fit its validated current intent constraints; never truncate the URL. Verify the current official platform contracts during implementation rather than hard-coding an assumed universal character limit.

Do not add share-event analytics, request rows, or user identifiers. A static native-share button may be installed only after its handler is ready; do not rely on the theme script's generic `.js` class, because that script can load while the share script fails. Bind controls independently, use `type=button`, and avoid calling the old form-copy endpoint. Never log clipboard/share payloads.

### Candidate browsing and snapshot stability

Keep `q` bounded to 100 characters, exact validated `list` IDs, and a positive `page`; use 20 rows per page. A new search/filter resets to page 1, Clear filters clears both, and a stale/out-of-range page returns the last valid page with a short explanation. Unknown list filters are cleared with an explicit notice instead of silently returning misleading zero candidates.

Within one list, sort by official rank. Across all lists, sort by published Hebrew list title, then rank, then a stable row ID; search filters that same neutral order. Explain the order in the results description. Do not sort by contact availability, response, popularity, or inferred electoral success. Keep unpublished rosters in the list selector with “roster unavailable”; selecting one shows that specific missing-data state.

Use one active publication lookup per request and pass its snapshot ID through every directory read, so a concurrent activation cannot combine two versions in one page. Display the snapshot identifier/check date with source and coverage. Before a source refresh or activation, record the previous publication ID; a failed activation leaves it active transactionally. For this release, candidate rows have no standalone share URL and no cross-snapshot personal identity guarantee.

### Chosen storage change for publication isolation

Keep the local transcript as the one source format and CLI import path. Add snapshot-owned metadata rather than storing public truth on mutable `elections`/`electoral_lists` rows:

- `election_snapshot_metadata`: one row per source snapshot, linked to election ID, carrying approval state (submitted/approved/unknown), exact approval evidence URL when present, and parser/schema version.
- `electoral_list_versions`: unique `(snapshot_id, list_id)`, carrying official list key, title, letters, roster-published flag, submitting-party text, source URL, and declared candidate count. Display fields come from this row; list identity remains in the existing `electoral_lists` table.
- Reuse `candidacy_versions` for names, rank, and listed/withdrawn/replaced status. Join list versions and candidate versions on the same active snapshot. Do not require recipient/contact projection to render the new directory.

Use the next unused additive migration number after the baseline is fixed. Backfill only from retained trustworthy source artifacts/records. If the original version cannot be reconstructed, mark its metadata unknown and require a reviewed re-import; do not bless the latest mutable row as historical truth. Never rewrite already-applied migrations to manufacture a successful upgrade.

`import` validates and writes an immutable draft. Identical normalized source content plus parser/schema version is a no-op; differing retrieval timestamps alone need not create a new candidate version. Source/approval/content changes produce a new snapshot. `activate` validates the target election, complete snapshot references, and validation report, then switches the active pointer in one transaction. “Approved” is evidence metadata, not a consequence of activation. Prevent multiple active publications for the same election, with a migration that diagnoses pre-existing conflicts instead of silently choosing one.

The new read-only directory needs no new `recipients` rows. Leave historical recipients and generated requests intact. Retire the old import activation's bulk recipient deactivate/create behavior for this release; if contact projection returns later, treat it as a separate reviewed operation. Reactivating a previous valid snapshot uses the same activation checks and restores its own metadata, not the latest list rows. Keep cross-snapshot identity matching deferred.

### Delivery checklist with evidence ownership

| Work item | Responsible role | Concrete completion evidence |
| --- | --- | --- |
| Preserve baseline | Implementer | Checkpoint including all listed untracked files, exact base commit, and recoverable original state; no destructive branch cleanup. |
| Share-first UI | Implementer | One reusable ShareOptions component, ten mapped routes, uniform navigation, and retired-route checks; no writes from the public share journey. |
| Content | Implementer prepares; named language reviewers approve | All locale keys populated, draft summaries matched to canonical clauses, reviewer/date/version recorded. This task cannot invent reviewer approval. |
| Candidate refresh | Implementer extracts/validates; operator reviews activation report | Source timestamps, hash, coverage, row/list diff, approval evidence, activation/rollback rehearsal. Refresh against the official source at execution time. |
| Accessibility | Implementer runs automation/manual browser checks; assistive-technology tester completes screen-reader checks | The verification table's evidence, remaining issues, and explicit tested browser/AT versions. Unavailable equipment is recorded as not tested, never passed. |
| Release | Operator/deployer | Verified backup/recovery path, recorded prior release/publication, current checks, and post-deploy smoke including social metadata. No production change is part of this planning task. |

Add focused regressions for: all ten slugs and canonical IDs; hidden/unknown demand handling; locale/key completeness; encoded social URLs; copy cancel/failure paths; legacy POSTs causing no writes; sharing with zero recipients; cookie/cache boundaries; two snapshots with a draft-only metadata change; unknown approval; same-snapshot directory reads; rollback; and historical Hebrew-name fallback. Reuse existing helpers and keep pure URL/mapping checks small. Browser layout and screen-reader assertions need browser/AT evidence, not brittle string tests.

Remaining external dependencies are now explicit: human translation/content review, real assistive-technology/usability sessions, execution-time CEC verification, and production access for release validation. These do not prevent implementing the scoped slices; they cannot be completed by adding more prose or marking a checkbox.

## Email and legacy surface policy

Interpret “without sending mails at the moment” as **no campaign email or direct-message workflow** in the new public journey.

| Surface | Next-release treatment |
| --- | --- |
| Letter builder, email handoff, direct recipient WhatsApp, report-sent, multi-recipient basket | Retire from the public journey. Reject obsolete mutation endpoints without writing new requests/actions; remove active links and controls, not merely CSS-hide them. |
| Old `/request` and `/request/build` GET links | Explicit compatibility redirect: a valid demand becomes the corresponding issue; a recipient-only link goes to the candidate directory; otherwise home. Use a temporary redirect during rollout. Do not forward arbitrary or personal query text. |
| Old generated-result links | Continue read-only rendering under existing retention rules. Remove links that restart retired actions, preserve historical meaning, and offer a current issue link where mapping is unambiguous. Do not label historical recipients as current candidates. |
| Support signup | Remains disabled; do not re-enable it as a share conversion step. |
| Reply intake | Pause new public submissions in this release and remove reply calls to action. Keep admin access/moderation and retention for existing records. Existing form URLs explain the pause. |
| Privacy/deletion | Preserve access for historical data, including the existing verification mechanism. Disabling its transactional email is a separate operational decision and must not strand data-deletion requests. |
| Old tables, mail module, object cleanup, admin | Keep for compatibility and historical obligations in this release. Defer destructive schema cleanup and broad module deletion. |

Use existing campaign controls where appropriate, plus explicit route retirement for obsolete writes. Avoid adding a generalized feature-flag framework. No new action tracking is necessary for problem sharing; retain old event history according to existing policy. Success can be established through usability checks instead of new visitor profiling.

## Data reconciliation and correctness gates

Consolidate to **one CEC source format and one import/activation path**. The local full-name transcript is closer to the observed source pages than PR #7's required given/family split. Keep authoritative `fullNameHe`, optional reviewed split names, list roster availability, approval state, official list keys, source URLs/dates, and content hashes. Reuse useful PR #7 draft-refresh and publication-gate ideas after review rather than copying the alternate importer wholesale.

Two concrete local correctness issues must be fixed before activation:

1. **Draft changes leak into active metadata.** Reproduced against an in-memory database: activate the submitted snapshot, import a second unactivated draft with a changed list title and `approved` status; the active directory immediately shows the draft title and approved banner. `upsertElection` and `upsertList` update shared rows read by the active directory. Bind all displayed list metadata and approval state to the active publication's snapshot; importing a draft must not change any public field. Add one meaningful regression for this exact lifecycle, including rollback.
2. **Unknown approval is treated as approved.** `directoryElectionState` maps every value except `submitted_not_approved` to approved, while migration 020 permits `unknown`. Render an explicit unknown/unverified state instead.

Additional acceptance requirements:

- Validate schema version, expected election number, source provenance, unique list keys, ranks/counts, row references, and list-level missingness. Identical import is a harmless no-op; a changed import produces a reviewable diff.
- Never use ballot letters, list rank, or a guessed name split as a person identity. Avoid silent cross-snapshot identity matching; retain historical snapshot links and require reviewed mappings when identities must carry forward.
- Draft, active, and superseded snapshots remain separate. Activation switches only the intended election's publication; the new read-only directory does not create/deactivate contact recipients.
- Re-import and rollback preserve active names, statuses, list ranks, and existing generated-request links. Hebrew-only names must also resolve on historical result pages, whose current SQL still requires the exact request locale.
- Exercise migration 020 against a populated prior schema with foreign-key validation, not only a fresh database. The migrator wraps SQL files in a transaction, so in-file `PRAGMA foreign_keys=OFF` is not a substitute for proving a table rebuild safe.
- Public directory visibility must not depend on `email` or `whatsapp`; publication eligibility and contactability are separate concepts.
- Store an immutable source snapshot and validation summary. Publish the verified current status; only an authoritative approval source can move it to approved.

## Implementation sequence and bounded handoffs

### 0. Preserve and reconcile the baseline

Before source edits, checkpoint the existing tracked and untracked candidate work on a dedicated branch or equivalent reversible backup. Do not stash away or reset unexplained work. Create `codex/share-first` from the agreed baseline after preservation. Record exact adopted commit IDs and selected PR #7 pieces; keep unrelated worktrees intact.

Output: a short integration checklist and a recoverable baseline. Preserve the local importer/full-name schema as the starting point, use PR #7 only for selected reviewed improvements, and leave PR #1 separate. Do not merge the two importers or all old branches as a preparatory shortcut.

### 1. Ship the problem-to-share vertical slice

Implement home issue cards, durable issue routes, shared share controls, metadata/assets, simplified navigation, and legacy route handling together. No candidate-data dependency is required for this slice. Keep the existing Hono/SQLite/CSP/theme architecture.

Likely files: `src/public.tsx`, `src/content.tsx`, `src/layout.tsx`, `src/assets.ts`, a small issue mapping/share helper, `src/requests.tsx` compatibility boundaries, `src/responses.tsx` pause handling, locale JSON, targeted route tests, README/SPEC/privacy copy.

Start the shared layout/content proof with English and Hebrew, then apply the same keys to all seven locales before release. Human review of political summaries remains necessary; machine translation is not approval.

Acceptance: home card Share → named social destination takes two site-control activations (excluding external platform/OS actions); reading an issue first adds one navigation. Sharing works without any recipient or contact data; public GETs create no generated-request/action records; native-share cancellation and non-JS/clipboard fallbacks work; old write routes cannot continue the retired mail flow; historical read links survive. Apply the consolidated UI/UX contract and record its verification results.

### 2. Reconcile and refresh candidate data

Unify the source schema/importer, fix publication isolation and unknown-state labeling, refresh official rosters, and expose the read-only candidate directory. Present a compact added/removed/changed/coverage report before activation. Validate in an isolated database and then staging; keep automatic ETL disabled.

Likely files: `src/integrations/elections/*` (only the chosen ingestion/publication path), `src/recipients.ts`, `scripts/elections.ts`, additive migration(s), candidate transcript, candidate directory route, importer/directory tests, election operations docs.

Acceptance: two successive snapshots plus rollback work; a draft cannot alter active data; submitted/approved/unknown are truthful; all locales show Hebrew-original names when translations are absent; missing contacts do not hide people; old seed contacts do not appear as current candidates.

If approval is still pending, ship the accurately labeled submitted directory. The future approved refresh should then be a data operation, not another UI rewrite.

### 3. Consolidate copy, verify, and release

Update README, SPEC, privacy/methodology, election operations, and status notes to the shipped contract. Mark earlier journey plans as historical with a link here. Bring in missing informational pages from PR #1 only after checking existing equivalents and reviewed text. Do not combine this with broad code cleanup.

Required checks: `npm run typecheck`, `npm test`, and representative compiled page smoke. Run targeted tests during iteration, then one complete suite after the final source changes. Complete the UI/UX verification matrix above, including 320px reflow, zoom, keyboard and assistive-technology checks, all seven locales, RTL/LTR, light/dark, no-JS behavior, and sharing failure states. Check real public share previews and that metadata/images are reachable anonymously.

Before production: record the current deployment and a recoverable SQLite backup using the existing single-disk operations model; activate data separately from deploying code. A failed candidate activation must leave the previous snapshot usable. Do not drop historical tables. Use code rollback only when schema compatibility is established; data publication rollback is a distinct operation.

## Token-efficient execution

Use this document as the single contract, with **three bounded implementation tasks after baseline preservation**, sequentially in the same repository context: sharing, candidate reconciliation, release verification. No agent swarm or competing redesigns is needed.

- Read only the slice's file set and the short decision section; search before opening whole files. Keep generated JSON, full candidate rosters, compiled output, and full test logs out of model context.
- Extract/validate candidate rows programmatically from observed official material; give the model only source metadata, counts, diffs, and anomalous rows for review. Do not spend tokens retyping rosters.
- Reuse route helpers, localized canonical content, existing clipboard/social links, CSS tokens, and tests. No SPA, new database, external CMS, scheduled crawler, social login, auto-posting, or runtime image service.
- Resolve the two importer approaches once. Avoid implementing a social layer on top of the contact-dependent letter builder and then removing that dependency later.
- Keep one compact handoff per slice: base commit, files changed, decisions, exact checks/results, remaining blocker. Make small commits per completed slice; do not produce another long parallel planning document.
- Ask for review of concrete content and working behavior, not repeated permission for routine edits. Existing authorization and repository constraints persist.

Suggested first implementation prompt:

> Implement slice 1 of docs/SHARE_FIRST_PLAN.md after preserving the current uncommitted candidate work. Use the existing Hono SSR architecture. Deliver problem cards, stable issue pages, direct social/native sharing with fallback, accurate metadata, simplified navigation, and the documented legacy-route policy. Candidates must not be required to share. Keep all seven locales and existing privacy/CSP protections. Do not merge candidate importers, refresh production data, or deploy as part of this slice. Run the targeted regressions, typecheck, full tests, and page smoke; report the concrete result and remaining release checks.

Do not promise a precise token saving: the practical savings come from fixed scope, one canonical plan, compact data diffs, reuse, and avoiding duplicate implementations.
