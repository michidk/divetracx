# DiveMate data consistency audit and reconciliation plan

Audit date: 2026-08-29

Deduplication follow-up: 2026-08-31

This document records the inconsistencies found in the local Divetracx PostgreSQL
database after importing a DiveMate `.ddb` backup. It also defines a safe,
repeatable reconciliation approach. The source rows must remain traceable and a
later DiveMate synchronization must not undo a reconciliation decision.

## Audit scope and baseline

The audit used read-only PostgreSQL transactions. No source or PostgreSQL data was
changed.

The imported data contained:

| Entity | Rows |
| --- | ---: |
| Divers | 1 |
| Dives | 229 |
| Dive sites | 70 |
| Buddies | 22 |
| Equipment | 27 |
| Tanks | 264 |
| Certifications | 19 |
| Dive types | 18 |
| Shops | 69 |

The database is structurally sound. The audit found no broken foreign keys,
future dive or certification dates, invalid coordinates, non-positive dive
durations or depths, average depths greater than maximum depths, negative surface
intervals or equipment weights, invalid ratings, impossible gas percentages,
negative tank pressures, end pressures greater than start pressures, or update
timestamps older than creation timestamps. Site, buddy, and equipment names did
not have exact normalized duplicates.

The observed problems are source-data quality and identity problems rather than
database corruption.

## 1. Dive numbering and unlinked-site records

### Findings

There are 229 dive rows but only 215 distinct dive numbers. Every number from 1
through 215 exists, while these 14 numbers occur twice:

`80, 122, 134, 135, 137, 140, 142, 147, 152, 164, 166, 172, 173, 174`

There are also 14 dives without a linked site. Their original DiveMate payloads
contain `PlaceID = 0` and an empty place name. Divetracx therefore correctly sets
`site_id` to `NULL`; the relationship was not lost by the importer.

The importer copies DiveMate `Logbook.Number` directly into `dives.number` and
uses the source row ID as the idempotent import identity. It neither creates the
duplicate numbers nor fabricates the site-less rows. All 14 records have unique
source IDs and UUIDs, DiveMate `Status = 2`, and actual depth-profile data.

Twelve records are strongly associated with another logged dive by temporal
overlap, adjacency, matching maximum depth, or a combination of those signals.
They appear to be secondary computer profiles or fragments that DiveMate stored
as independent `Logbook` rows. They are not byte-for-byte duplicate rows and must
not be deleted merely because their number repeats.

### Proposed record-level reconciliation

The IDs below are DiveMate external IDs, retained in `dives.external_id`.

| Source ID | Source no. | Date/time | Duration | Max depth | Proposed primary | Evidence | Proposed action |
| --- | ---: | --- | ---: | ---: | --- | --- | --- |
| 81 | 80 | 2023-08-12 13:06 | 15.0 min | 4.55 m | None yet | A second shallow dive numbered 80 starts 83 minutes later; profiles do not overlap | Manual review; keep as a standalone dive unless the diver identifies it as a test or accidental recording |
| 108 | 106 | 2023-11-26 13:58 | 17.0 min | 3.98 m | Source 107, dive 105 | Fully contained in the primary's 103-minute shallow interval | Link as a secondary profile/fragment |
| 124 | 122 | 2024-06-10 18:48 | 5.0 min | 2.71 m | None yet | No overlap; short, shallow, and missing descriptive metadata | Manual review; classify as standalone, test, or ignored |
| 137 | 134 | 2024-08-15 17:11 | 1.5 min | 4.70 m | Source 136, dive 133 | Starts approximately 30 seconds after the primary profile ends | Link as a trailing fragment |
| 139 | 135 | 2024-08-16 10:06 | 29.0 min | 33.40 m | Source 138, dive 134 | 28.5-minute overlap and identical maximum depth | Link as a secondary profile |
| 141 | 137 | 2024-08-16 13:10 | 6.1 min | 4.70 m | Source 140, dive 135 | Entire segment occurs inside the primary interval | Link as a fragment |
| 146 | 140 | 2024-08-17 10:43 | 43.9 min | 37.40 m | Source 145, dive 139 | Entire profile overlaps and maximum depth is identical | Link as a secondary profile |
| 148 | 142 | 2024-08-17 12:44 | 39.0 min | 22.80 m | Source 147, dive 140 | Entire profile overlaps and maximum depth is identical | Link as a secondary profile |
| 155 | 147 | 2024-09-22 16:58 | 8.5 min | 4.10 m | Source 154, dive 146 | Entire shallow segment occurs inside a long indoor dive | Link as a fragment |
| 161 | 152 | 2024-10-26 11:05 | 65.8 min | 42.90 m | Source 160, dive 151 | Entire profile overlaps and maximum depth is identical | Link as a secondary profile |
| 174 | 164 | 2025-06-28 16:42 | 35.4 min | 16.10 m | Source 173, dive 163 | Entire profile is contained in the primary interval | Link as a secondary profile; review the modest depth difference |
| 184 | 172 | 2025-07-01 11:14 | 0.8 min | 2.10 m | Source 183, dive 171 | Very short segment inside the primary interval | Link as a fragment |
| 185 | 173 | 2025-07-01 11:21 | 28.2 min | 17.40 m | Source 183, dive 171 | Entire profile overlaps and maximum depth is identical | Link as a secondary profile |
| 188 | 174 | 2025-07-02 11:10 | 37.7 min | 23.20 m | Source 187, dive 173 | Entire profile overlaps and maximum depth is identical | Link as a secondary profile |

The proposed primary assignments are evidence-based candidates, not destructive
merge instructions. A diver should confirm them before the records cease to
count as independent dives.

### Canonical profile boundary rule

A canonical dive profile must not have an open end. Its displayed and exported
depth series must:

1. begin at the surface (`0 m`),
2. remain continuous across any reconciled profile fragments, and
3. finish at the surface (`0 m`).

Raw DiveMate samples remain unchanged for provenance. If a source profile begins
below the surface or ends below the surface because its boundary sample is
missing, construct the canonical profile with an explicit `0 m` boundary sample
at the start or end. Do not replace the final measured sample; append the surface
boundary. When a linked fragment contains the actual ascent or surfacing tail,
merge that fragment first and add a synthetic boundary only if the merged series
still lacks `0 m`.

Profile reconciliation must reject ambiguous joins that would create a time
reversal, an unexplained gap, or overlapping samples without a deterministic
precedence rule. Such profiles remain pending manual review rather than being
silently spliced.

### Numbering consequence

Most site-less records reuse a number that DiveMate also assigned elsewhere.
Source 108 is the exception: it has number 106 without a second row numbered 106.
Conversely, number 166 is duplicated by two fully linked dives. This confirms
that missing sites and duplicate numbering are correlated but are not the same
problem.

Do not enforce uniqueness on the current `dives.number` column until imported
source numbers and canonical display numbers are separated.

## 2. Duplicate shop identities

### Findings

There are 12 normalized shop-name groups with duplicate source identities. Each
row has a distinct DiveMate external ID, so the current importer correctly
preserves them as separate source entities.

| Normalized name | Source rows | Linked dives | Source rows referenced by dives | External IDs |
| --- | ---: | ---: | ---: | --- |
| ABC Divers | 6 | 14 | 1 | 4, 14, 24, 34, 44, 56 |
| Camp Plansee | 6 | 2 | 2 | 10, 20, 30, 40, 50, 62 |
| DCP | 6 | 22 | 3 | 1, 11, 21, 31, 41, 53 |
| Divers Indoor | 6 | 2 | 2 | 2, 12, 22, 32, 42, 54 |
| Divers Indoors | 6 | 0 | 0 | 3, 13, 23, 33, 43, 55 |
| Ducks | 6 | 6 | 1 | 6, 16, 26, 36, 46, 58 |
| Ducks Diving | 6 | 1 | 1 | 7, 17, 27, 37, 47, 59 |
| Ducks k | 6 | 0 | 0 | 9, 19, 29, 39, 49, 61 |
| Ducks Safaga | 6 | 1 | 1 | 5, 15, 25, 35, 45, 57 |
| Safaga | 6 | 0 | 0 | 8, 18, 28, 38, 48, 60 |
| Triton | 2 | 0 | 0 | 52, 64 |
| Triton Diving | 2 | 6 | 1 | 51, 63 |

The repeated external-ID patterns suggest the duplicates already exist in the
DiveMate backup. Name equality alone is insufficient to merge similarly named
groups such as `Divers Indoor` and `Divers Indoors`, or `Triton` and
`Triton Diving`; those require confirmation.

### Proposed reconciliation

1. Introduce a canonical shop identity independently of imported source rows.
2. Map all exact normalized-name duplicates to one canonical shop after checking
   their source payloads and linked dives.
3. Preserve each original shop row and external ID as a source alias. Do not
   delete the imported identities.
4. Review near-name groups (`Divers Indoor`/`Divers Indoors`,
   `Triton`/`Triton Diving`, and the `Ducks` variants) manually before merging
   across names.
5. Present canonical shops in the UI and exports while retaining source aliases
   for synchronization and audit history.

## 3. Tank breathing-time placeholders

### Findings

Of 264 tank rows, 262 contain `breathing_time_seconds = 0`; only two contain a
positive value (1,380 and 1,740 seconds). The source payload does not expose a
separate populated breathing-time value for the zero rows. Other tank data—gas
percentages, volumes, and pressure relationships—passed consistency checks.

A zero breathing time on a tank attached to a positive-duration dive should be
treated as “unknown/not supplied,” not as proof that the tank was never breathed.

### Proposed reconciliation

1. Change DiveMate parsing semantics so a missing or non-positive optional
   breathing time becomes `NULL`.
2. Backfill the 262 imported zero values to `NULL` after the parser change is in
   place; otherwise the next synchronization will restore the zeros.
3. Retain the two positive values unchanged.
4. Display and export `NULL` as unknown, not `0 seconds`.

## 4. Cross-entity deduplication scan

### Method and results

A follow-up read-only scan normalized identity labels by trimming whitespace,
lowercasing, and removing punctuation and spacing. It checked dive sites, buddies,
equipment, certifications, dive types, and shops. Dives were checked separately
because equal logbook numbers or overlapping profiles are candidate relationships,
not sufficient proof that two source rows are duplicates.

| Entity | Rows | Duplicate result |
| --- | ---: | --- |
| Divers | 1 | No candidate duplicates |
| Dives | 229 | No rows are safe to delete solely as duplicates; the 14 repeated numbers and 12 high-confidence profile/fragment relationships remain as described in section 1 |
| Dive sites | 70 | No duplicate normalized names |
| Buddies | 22 | No duplicate normalized full names |
| Equipment | 27 | No duplicate normalized names |
| Certifications | 19 | No duplicate normalized names |
| Dive types | 18 | No duplicate normalized names |
| Shops | 69 | 12 exact normalized-name groups covering 64 source rows; these reduce to 12 canonical identities while preserving 64 source aliases |

The scan found no repeated `(source_key, external_id)` identities. Existing unique
indexes therefore protect importer identity correctly. The actionable deduplication
work is canonicalization: retain each imported row as an alias and point normal UI,
statistics, and exports at one canonical entity. It is not safe to delete source
rows or coalesce similarly named entities automatically.

### `M/Y Longimanus` trip and `Ducks Safaga`

There are 15 dives with the exact boat name `M/Y Longimanus`, forming one
continuous trip from 2023-05-12 through 2023-05-17. Their current shop assignments
are inconsistent:

| Current shop | Shop source ID | Dives | Dive source IDs |
| --- | ---: | ---: | --- |
| `Ducks Safaga` | 25 | 1 | 60 |
| `Ducks` | 26 | 6 | 62, 63, 64, 66, 67, 68 |
| No linked shop | — | 8 | 69, 70, 71, 72, 73, 74, 75, 76 |

All 15 should resolve to one canonical `Ducks Safaga` shop. Source shop ID 25 is
the preferred canonical anchor because it is the only one of the six exact-name
`Ducks Safaga` rows already referenced by a dive. Source shop IDs 5, 15, 35, 45,
and 57 should remain preserved as aliases of that canonical shop. The six trip
dives currently linked to the broader `Ducks` source ID 26 and the eight unlinked
trip dives should resolve to the same canonical shop without rewriting their raw
DiveMate payloads.

This boat-and-date rule applies only to this identified trip. It does not imply
that every dive linked to `Ducks` belongs to `Ducks Safaga`, nor that all `Ducks`
name variants are globally interchangeable.

### Other trip-level identity inconsistencies

The broader trip scan found the following additional cases:

| Confidence | Scope | Finding | Proposed reconciliation |
| --- | --- | --- | --- |
| High | `Patrizia`, 2025-06-27 through 2025-07-05 | One continuous trip is split across shop source IDs 66 (`Capo Galera`, 16 dives), 68 (`Capo Galero`, 3 dives), and 69 (`Cappo Galera`, 4 dives). Source ID 67 (`Capo de Galera`) is unreferenced. The trip has 23 linked shop assignments because the previously identified secondary/fragment rows remain independent source rows. | Use `Capo Galera` source ID 66 as the canonical anchor and retain source IDs 67–69 as aliases. Resolve all dives from this trip to that canonical shop. |
| High | `SS Excellence`, 2026-05-08 through 2026-05-13 | The same trip uses `SS Excellence` on 14 dives, `SS Ecelence` on source dive 211, and `SS Exellence` on source dive 212. | Canonicalize all three spellings to `SS Excellence`, preserving the source text. |
| High | `SS Excellence`, 2026-05-08 | Source dive 210 records divemaster `Lashin`; 11 other dives on the trip record `Mohamed Lashin`. | Treat `Lashin` as a display alias of `Mohamed Lashin` for this trip, while preserving the raw value. |
| Review | `SS Excellence`, 2026-05-11 | Source dive 221 occurs within the trip and has neither boat nor divemaster populated. | Review and, if confirmed, assign the canonical trip boat. Do not infer a divemaster because adjacent dives use both Ahmed and Mohamed Lashin. |
| Review | `M/Y Longimanus`, 2023-05-14 | Source dive 65 uses `M/Y Seaduction` while surrounding dives use `M/Y Longimanus`. | Confirm whether this was a real transfer to another vessel; do not canonicalize automatically. |

The computer field also contains a casing-only pair, `Mares Puck pro` (2 dives)
and `Mares puck pro` (8 dives), which is safe to normalize for display. By
contrast, `Shearwater Perdix2 AFB65CFF` and `Shearwater PetrelNative AFB65CFF`
share a device identifier but name different models. That pair requires source
or owner confirmation and must not be merged from string similarity alone.

## Reconciliation data model

Imported provenance and user decisions must be separate. A suitable model is:

- Preserve the source value as `source_number`.
- Use `number` for the canonical Divetracx logbook number.
- Add a reconciliation classification such as `primary`, `secondary_profile`,
  `fragment`, `standalone`, or `ignored`.
- Add a nullable `primary_dive_id` self-reference for secondary profiles and
  fragments.
- Store canonical profile samples separately from raw source payloads, including
  whether a `0 m` boundary was source-recorded or synthesized.
- Record reconciliation notes, who/what made the decision, and a timestamp.
- Represent shop source rows as aliases of a canonical shop rather than deleting
  duplicate imported rows.

A separate reconciliation table is preferable if source tables are intended to
remain a faithful mirror. In either design, the DiveMate upsert must not overwrite
canonical numbering, classifications, primary links, aliases, or review notes.

## Safe implementation sequence

1. **Capture a recovery point.** Export PostgreSQL data and the source `.ddb`,
   record the source fingerprint, and generate a machine-readable audit report.
2. **Add schema support.** Add source/canonical numbering and reconciliation
   metadata, plus canonical shop aliases. Generate and commit the Drizzle
   migration and metadata together.
3. **Protect manual decisions.** Modify synchronization so it only refreshes
   imported fields and never overwrites reconciliation metadata.
4. **Normalize tank placeholders.** Update the parser and tests, then convert
   imported zero breathing times to `NULL`.
5. **Apply high-confidence links.** Stage the 12 proposed fragment/profile links
   and require confirmation before excluding them from canonical totals. Merge
   usable profile tails and enforce explicit `0 m` start and end boundaries.
6. **Resolve the two uncertain dives.** Review source IDs 81 and 124 with the
   diver and classify each as standalone, fragment, test, or ignored.
7. **Consolidate shops.** Map exact-name duplicates to canonical shops and review
   near-name groups manually. Map all 15 `M/Y Longimanus` trip dives to the
   canonical `Ducks Safaga` identity anchored by source shop ID 25. Map the
   `Patrizia` trip shop variants to canonical `Capo Galera` source ID 66.
8. **Assign canonical numbers.** Chronologically renumber only primary and
   confirmed standalone dives. Preserve every DiveMate number in
   `source_number`. Add uniqueness per diver only after this backfill succeeds.
9. **Update consumers.** Dashboard totals, dive lists, CSV/JSON/UDDF exports, and
   statistics should count canonical dives by default. Raw/source exports should
   remain available for lossless recovery.
10. **Add regression checks.** Test idempotent re-sync, preservation of manual
    decisions, duplicate-number detection, overlap candidate detection, shop
    alias resolution, canonical totals, raw export completeness, and the invariant
    that every canonical profile begins and ends at `0 m` without open ends.
11. **Verify reversibility.** Run synchronization twice and confirm stable counts,
    links, canonical numbers, aliases, and source payloads before considering the
    reconciliation complete.

## Acceptance criteria

- Every imported DiveMate row and external ID remains recoverable.
- Re-running synchronization does not resurrect a resolved inconsistency or
  overwrite a human decision.
- Canonical dive numbers are unique per diver and source numbers remain visible.
- Secondary profiles and fragments do not inflate normal logbook totals.
- Every canonical displayed/exported profile begins and ends at `0 m`; raw source
  samples remain available and distinguish synthesized boundary samples.
- The two uncertain short dives have explicit human-reviewed classifications.
- Duplicate shop source identities resolve to canonical shops without losing
  provenance.
- Unknown tank breathing times are represented as `NULL`.
- Raw exports remain lossless, while normal UI and exports use reconciled data.
