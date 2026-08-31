# Dive-site coordinate research

Database snapshot: 2026-08-30 (UTC)

This is a working research document, not an import file. In the initial snapshot,
the database had 70 dive sites and 42 matched
`latitude IS NULL OR longitude IS NULL`. All 42 were missing latitude and contained
the same invalid longitude (`-170.0000000`). Their DiveMate source values were also
the same malformed pair: `189°60'0.00"N`, `170°00'0.00"W`. Both coordinates
therefore needed to be replaced together.

On 2026-08-31, the 23 replacements currently marked **Confirmed** below were
written to the database. The original `source_latitude` and `source_longitude`
values were preserved for provenance. Nineteen malformed rows remain: 17
candidate replacements and two pending sites.

The 28 sites that already had populated coordinates in the initial snapshot are
audited separately below. All 28 decimal values accurately reproduce their DiveMate
degree-minute-second source text (maximum conversion difference:
`0.0000000444°`), but five source positions appear to identify the wrong place.

## Status and confidence

- **Confirmed**: a named place or dive site was matched directly, or an operator's
  own dive map publishes the coordinate.
- **Candidate**: the right site/feature is strongly indicated, but the coordinate
  may identify the shore entrance, surface feature, or feature centre rather than
  the exact underwater point. Review before importing.
- **Pending**: no defensible coordinate has been found yet. The Maps link is a name
  search, not a coordinate link.

For the existing-coordinate audit:

- **Verified**: the stored point matches a named map record, reef, dive entry, or
  the expected site feature.
- **Plausible**: the point is in the right context but may be an operator, parking
  place, boat entry, or surface landmark rather than the named underwater site.
- **Mismatch**: the stored point is demonstrably associated with another location
  or is implausibly far from the named site. A replacement candidate is included.

Google Maps coordinate links use `https://www.google.com/maps?q=<lat>,<lon>` so the
proposed latitude and longitude are visible in the URL.

## Austria

All eight Attersee matches have dedicated Google place records. They are also
independently corroborated (usually within tens of metres) by the
[Strany potápěčské Attersee records](https://stranypotapecske.cz/lokality/lokaldet.asp?lok=879).
For Hinkelsteine, the DiveMate note's original Google short link resolves to the
same named place; its marker differs from the independent database by about 380 m,
so the explicit saved Google place was preferred.

| DiveMate ID | Dive site | Water / region | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 45 | Dixie | Attersee | 47.8642349 | 13.5629251 | [47.8642349, 13.5629251](https://www.google.com/maps?q=47.8642349,13.5629251) | **Confirmed** | Named Google place “Tauchplatz Dixi”; independent record: 47.86388, 13.56305. |
| 29 | Hinkelsteine | Attersee | 47.8126308 | 13.5467102 | [47.8126308, 13.5467102](https://www.google.com/maps?q=47.8126308,13.5467102) | **Confirmed** | Named Google place from the DiveMate note; independent record: 47.81605, 13.54658. |
| 28 | Kohlbauernaufsatz | Attersee (source says “Atternsee”) | 47.8198055 | 13.5091968 | [47.8198055, 13.5091968](https://www.google.com/maps?q=47.8198055,13.5091968) | **Confirmed** | Named Google place; independent record: 47.81972, 13.50862. |
| 44 | Nußdorf Hausboot | Attersee | 47.8799903 | 13.5301305 | [47.8799903, 13.5301305](https://www.google.com/maps?q=47.8799903,13.5301305) | **Confirmed** | Named Google dive-entry record; independent record: 47.88017, 13.52975. |
| 46 | Schlierwand | Attersee | 47.8294427 | 13.5457054 | [47.8294427, 13.5457054](https://www.google.com/maps?q=47.8294427,13.5457054) | **Confirmed** | Named Google place; independent record: 47.82917, 13.54583. |
| 30 | Schwarze Brücke | Attersee | 47.8540000 | 13.5567890 | [47.8540000, 13.5567890](https://www.google.com/maps?q=47.8540000,13.5567890) | **Confirmed** | Named Google place; independent record: 47.85362, 13.55667. |
| 43 | Twin Towers | Attersee | 47.8670657 | 13.5650045 | [47.8670657, 13.5650045](https://www.google.com/maps?q=47.8670657,13.5650045) | **Confirmed** | Named Google place; independent record: 47.86695, 13.56528. |
| 42 | Unterwasserwald | Attersee | 47.9234425 | 13.5812536 | [47.9234425, 13.5812536](https://www.google.com/maps?q=47.9234425,13.5812536) | **Confirmed** | Named Google place; independent record: 47.92333, 13.58112. |

## Croatia

The four Vrsar/Istria coordinates marked confirmed come from
[Triton Diving's own dive-site map](https://www.tritondiving.eu/dive-sites/). Its
embedded map data and marker code confirm that the first value is latitude and the
second longitude (the underlying custom-field labels happen to be reversed).

| DiveMate ID | Dive site | Region | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 37 | Baron Gautsch | Istria | 44.9402778 | 13.4138889 | [44.9402778, 13.4138889](https://www.google.com/maps?q=44.9402778,13.4138889) | **Confirmed** | Exact wreck marker on Triton Diving's operator map. |
| 36 | Consolidated B24 | Istrien | — | — | [Search by name](https://www.google.com/maps/search/?api=1&query=Consolidated+B-24+wreck+Vrsar+Istria+Croatia) | **Pending** | The linked dive was with Triton Diving in Vrsar, reached by a 15-minute Zodiac, and had a recorded maximum depth of 30.96 m. Triton's current public dive map omits the aircraft and no position was found. This rules out both Diving Center Shark's 52 m Medulin wreck and the famous Vis B-24 at 43.02925, 16.25771. |
| 39 | HMS Coriolanus | Istrien | 45.3194444 | 13.4236111 | [45.3194444, 13.4236111](https://www.google.com/maps?q=45.3194444,13.4236111) | **Confirmed** | Exact wreck marker on Triton Diving's operator map. |
| 38 | Saline | Istrien | 45.1207796 | 13.6153865 | [45.1207796, 13.6153865](https://www.google.com/maps?q=45.1207796,13.6153865) | **Confirmed** | Exact reef marker on Triton Diving's operator map. |
| 40 | Sturag | Istrien | 45.0513924 | 13.6233687 | [45.0513924, 13.6233687](https://www.google.com/maps?q=45.0513924,13.6233687) | **Confirmed** | Exact island marker on Triton Diving's operator map. |
| 7 | Hrid Mala Giavina | Selce | 45.0502513 | 14.7441440 | [45.0502513, 14.7441440](https://www.google.com/maps?q=45.0502513,14.7441440) | **Candidate** | Current operator spelling is [Hrid Mala Glavina](https://mihuric.hr/hrid-mala-glavina/), and this point is the named Google dive spot “Reef Mala Glavina”. It was not imported because other published data conflict: [DiveNavigator](https://www.divenavigator.com/dive-sites/croatia/hrid-mala-glavina) gives 45.0562, 14.7417, while an independent Croatia dataset lists “Glavina” at 45.0687016, 14.7379231. Establish whether those names refer to this same site before import. |
| 8 | Pyramida Riff | Selce | — | — | [Search by operator spelling](https://www.google.com/maps/search/?api=1&query=Hrid+Piramida+Selce+Croatia) | **Pending** | Matched by name to Mihurić's current [Hrid Piramida](https://mihuric.hr/hrid-piramida/) page. Its operator diagram confirms an isolated rock just off Krk but is not georeferenced. [Dive Champ](https://divechamp.com/divesite/hrid-piramida) embeds 45.0562, 14.7418, but marks the record unverified; that point is within about 10 m of DiveNavigator's conflicting Hrid Mala Glavina position, so it is not yet defensible. |
| 10 | Selce Riff Kamenjak | Selce | 45.0723083 | 14.7335672 | [45.0723083, 14.7335672](https://www.google.com/maps?q=45.0723083,14.7335672) | **Confirmed** | Exact “Kamenjak Languste” dive-site record in an independent Croatia dataset, 65 m from OpenStreetMap's official-source [Kamenjak islet](https://www.openstreetmap.org/way/737397543); Mihurić's [Hrid Kamenjak](https://mihuric.hr/hrid-kamenjak/) diagram confirms the paired inner/outer reef. |
| 2 | Selce D.C. Mihurić Housereef | Selce | 45.1524907 | 14.7192413 | [45.1524907, 14.7192413](https://www.google.com/maps?q=45.1524907,14.7192413) | **Confirmed** | Named Google record for Diving Center Mihurić; the operator lists this as its [House reef](https://mihuric.hr/house-reef/). |

## Egypt

Red Sea spellings vary considerably between operators. Matches below use the site
name, reef group, and the database's trip context—not name similarity alone.

| DiveMate ID | Dive site | Region | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 70 | Malahi | Fury Shoal | 24.1963800 | 35.6612000 | [24.1963800, 35.6612000](https://www.google.com/maps?q=24.1963800,35.6612000) | **Confirmed** | Exact “Malahi” record in an independent Red Sea dive-site dataset. |
| 62 | Shaab Maksour | Hamata, Fury Shoals | 24.2439320 | 35.6499154 | [24.2439320, 35.6499154](https://www.google.com/maps?q=24.2439320,35.6499154) | **Candidate** | OpenStreetMap's named [Shaab Maksour reef polygon](https://www.openstreetmap.org/way/1216501695) places its centre here. Separate named dive-entry markers exist for [North](https://www.openstreetmap.org/node/416090842) and [South](https://www.openstreetmap.org/node/271180623), but the DiveMate row does not say which section was dived. |
| 12 | Marsa Asalaya | Marsa Alam | 25.1553587 | 34.8514471 | [25.1553587, 34.8514471](https://www.google.com/maps?q=25.1553587,34.8514471) | **Confirmed** | Named Google place “Marsa Assalaya”; independent record: 25.15527, 34.85137. |
| 13 | Marsa Samaday | Marsa Alam | 25.0125140 | 34.9259438 | [25.0125140, 34.9259438](https://www.google.com/maps?q=25.0125140,34.9259438) | **Candidate** | “Marsa” and the shore-dive trip context indicate Samadai Beach/bay. This is intentionally not the offshore Shaab Samadai/Dolphin House marker. |
| 67 | Small Gotta | Saint Johns | 23.4295735 | 35.9033203 | [23.4295735, 35.9033203](https://www.google.com/maps?q=23.4295735,35.9033203) | **Candidate** | Exact-name match “St John's Small Gota” in the [Dive Vibe Red Sea dataset](https://github.com/jbunderwater/dive-vibe-community/blob/fbc5551ef9ee9144340edcbbb88d4bac01c0dc53/divesites/red-sea/st-johns-small-gota.md). Its recorded OSM ID now points to an unrelated US node, so the coordinate needs a second source before import. |
| 69 | Umm Chararim | Saint Johns | 23.6360000 | 35.8263000 | [23.6360000, 35.8263000](https://www.google.com/maps?q=23.6360000,35.8263000) | **Confirmed** | Named Google place “Cave Reef St. Johns Umm Khararim”; independent record: 23.63315, 35.82790. |
| 6 | Abu Gushun | Red Sea | 24.4383333 | 35.2131166 | [24.4383333, 35.2131166](https://www.google.com/maps?q=24.4383333,35.2131166) | **Candidate** | The dive notes identify the Hamada wreck. A named [OpenStreetMap wreck marker](https://www.openstreetmap.org/node/663869769) is here, while [MarsaAlam.com's wreck guide](https://marsaalam.com/marsa-alam-shipwrecks/) gives only the conflicting approximate position 24.42, 35.25; OSM also marks its position unverified. |
| 3 | Big Abo Galawa | Fury Shoals | 24.2280865 | 35.5738921 | [24.2280865, 35.5738921](https://www.google.com/maps?q=24.2280865,35.5738921) | **Confirmed** | Named Google place “Abu Galawa Kebir” (big). |
| 5 | Sh'aab Claudio | Fury Shoals | 24.2198492 | 35.6112986 | [24.2198492, 35.6112986](https://www.google.com/maps?q=24.2198492,35.6112986) | **Confirmed** | Named Google place “Shaab Claudio Reef”; independent record: 24.21988, 35.61210. |
| 4 | Small Abo Galawa | Fury Shoals | 24.2531790 | 35.5399491 | [24.2531790, 35.5399491](https://www.google.com/maps?q=24.2531790,35.5399491) | **Confirmed** | Named Google place “Sha'ab Abu Galawa Soraya” (small); independent record: 24.25277, 35.53920. |

## Germany

These three remain candidates because public map records identify the associated
shore landmark, not an exact underwater marker. They are useful for review but
should not yet be imported as confirmed dive-site coordinates.

| DiveMate ID | Dive site | Water | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 34 | Allmanshausen Wintertauchplatz | Starnberger See | 47.9330908 | 11.3338167 | [47.9330908, 11.3338167](https://www.google.com/maps?q=47.9330908,11.3338167) | **Candidate** | Named Google dive-site record “Steilwand, Starnberger See, Allmannshausen”; the winter entry may differ from this marker. |
| 47 | Kapelle | Starnberger See | 47.9638814 | 11.3481991 | [47.9638814, 11.3481991](https://www.google.com/maps?q=47.9638814,11.3481991) | **Candidate** | Votivkapelle/St. Louis memorial shoreline marker; exact dive entry not independently published. |
| 33 | Leoni | Starnberger See (source says “Stanberger”) | 47.9555161 | 11.3436627 | [47.9555161, 11.3436627](https://www.google.com/maps?q=47.9555161,11.3436627) | **Candidate** | Seehotel Leoni shoreline marker; exact training entry needs local confirmation. |

## Italy

The database trip used Capo Galera. The operator confirms many of the names on its
[dive-site list and map](https://www.capogalera.com/diving-spots.aspx?ver=it), but
its public pages do not publish coordinates for every underwater entrance. Direct
named natural-feature matches are recorded. Alghero Divers also publishes a
numbered [Punta Giglio aerial site map](https://www.algherodivers.com/en/punta-giglio-porto-conte).
Its underlying Google Earth image was registered against current north-up Google
satellite imagery using 15 matched shoreline and landmark features. The derived
marker positions are approximate: the same registration places the operator's
Grotta dei Cervi marker about 145 m from Google's named natural-feature marker.
They therefore remain candidates rather than confirmed coordinates.

| DiveMate ID | Dive site | Region | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 53 | Cala Verde | Capo Caccia | 40.5653435 | 8.1651338 | [40.5653435, 8.1651338](https://www.google.com/maps?q=40.5653435,8.1651338) | **Candidate** | Named surface feature “Grotta Verde”; the DiveMate name and air-pocket notes are consistent, but exact underwater entrance is unverified. |
| 49 | Grotta della Madonnina | Capo Caccia | 40.5602825 | 8.1638158 | [40.5602825, 8.1638158](https://www.google.com/maps?q=40.5602825,8.1638158) | **Confirmed** | Direct named Google natural-feature record; also on the [Capo Galera site list](https://www.capogalera.com/diving-spot/3/grotta-della-madonnina/it). |
| 54 | Grotta di Nereo | Capo Caccia | 40.5616595 | 8.1611888 | [40.5616595, 8.1611888](https://www.google.com/maps?q=40.5616595,8.1611888) | **Confirmed** | Direct named Google natural-feature record; also on the [Capo Galera site list](https://www.capogalera.com/diving-spot/2/grotta-di-nereo/it). |
| 56 | Il Tunnel & Grotta de Cabriol | Capo Caccia | 40.5637139 | 8.1620502 | [40.5637139, 8.1620502](https://www.google.com/maps?q=40.5637139,8.1620502) | **Candidate** | Surface marker for Escala del Cabirol; Capo Galera lists [Il Tunnel](https://www.capogalera.com/diving-spot/8/il-tunnel/it) and [Grotta del Cabirol](https://www.capogalera.com/diving-spot/6/grotta-del-cabirol/it) separately. |
| 58 | Porticato | Capo Caccia | 40.5693348 | 8.1575632 | [40.5693348, 8.1575632](https://www.google.com/maps?q=40.5693348,8.1575632) | **Candidate** | Exact-name “Il Porticato” coordinate in the [Divelog Italy dataset](https://github.com/trousiakis/divelog/blob/cc967933afbcf50d3031b79b0289ca78296f97c0/diveSites/Italy.json). It is geographically consistent with [Capo Galera's description](https://www.capogalera.com/diving-spot/7/il-porticato/it): under Capo Caccia, a short distance from the Nereo cave complex. The operator does not publish a coordinate, so retain candidate status. |
| 60 | Dolmen | Isola Foradada | 40.5700000 | 8.1516670 | [40.5700000, 8.1516670](https://www.google.com/maps?q=40.5700000,8.1516670) | **Candidate** | Centre marker for Isola di Foradada, not the exact “Dolmen” underwater point. |
| 51 | Grotta dei Cervi | Punta Giglio | 40.5681912 | 8.2041873 | [40.5681912, 8.2041873](https://www.google.com/maps?q=40.5681912,8.2041873) | **Confirmed** | Direct named Google natural-feature record; also on the [Capo Galera site list](https://www.capogalera.com/diving-spot/5/grotta-dei-cervi/it). |
| 52 | Grotta dei Falco | Punta Giglio | 40.5692463 | 8.2222748 | [40.5692463, 8.2222748](https://www.google.com/maps?q=40.5692463,8.2222748) | **Candidate** | Database spelling is singular; Alghero Divers calls it [Ennio Falco's Cave / Amphitrite](https://www.algherodivers.com/en/2-grotta-di-e-falco). Approximate position derived from marker 2 on its registered Punta Giglio aerial map. |
| 57 | Grotta dei Fantasmi | Punta Giglio | 40.5692359 | 8.2065887 | [40.5692359, 8.2065887](https://www.google.com/maps?q=40.5692359,8.2065887) | **Candidate** | Both [Capo Galera](https://www.capogalera.com/diving-spot/4/grotta-dei-fantasmi/it) and [Alghero Divers](https://www.algherodivers.com/en/4-grotta-dei-fantasmi) confirm the site. Approximate position derived from marker 4 on Alghero Divers' registered aerial map. |
| 55 | Grotta del Pozzo | Punta Giglio | 40.5711452 | 8.1972809 | [40.5711452, 8.1972809](https://www.google.com/maps?q=40.5711452,8.1972809) | **Candidate** | Approximate position derived from marker 6 on Alghero Divers' registered aerial map. Its [site description](https://www.algherodivers.com/en/6-grotta-del-pozzo) and an [archived independent guide](https://web.archive.org/web/20071022032608/http://www.portoconte.it/diving/luoimm/pozzo.htm) independently place it just inside Porto Conte Bay, on the west side of Capo Bocato. |
| 59 | Grotta delle Stalattiti | Punta Giglio | 40.5700661 | 8.2075653 | [40.5700661, 8.2075653](https://www.google.com/maps?q=40.5700661,8.2075653) | **Candidate** | [Alghero Divers' site page](https://www.algherodivers.com/en/3-grotta-delle-stalattiti) confirms the cave and 7 m entrance. Approximate position derived from marker 3 on its registered Punta Giglio aerial map. |
| 50 | La Bramassa | Punta Giglio | 40.5727847 | 8.1974792 | [40.5727847, 8.1974792](https://www.google.com/maps?q=40.5727847,8.1974792) | **Candidate** | Approximate position derived from marker 7 (“Bramassa's complex”) on Alghero Divers' registered aerial map. This supersedes the earlier Cala Bramassa surface-feature candidate at 40.5821535, 8.2051543, which is about 1.2 km from the operator marker and appears to be a different feature. |

## Existing-coordinate audit

The stored decimal values and their DiveMate source text agree for every row in
this section. This audit checks whether that source position makes geographic
sense. Distances quoted below are approximate straight-line distances to the
comparison point, not navigation distances.

| DiveMate ID | Dive site | Stored coordinates | Google Maps | Audit | Comparison / action |
| ---: | --- | ---: | --- | --- | --- |
| 27 | Föttinger | 47.8406639, 13.5445667 | [Stored point](https://www.google.com/maps?q=47.8406639,13.5445667) | **Verified** | 10 m from the named Google place “Tauchplatz Föttinger”. Keep. |
| 31 | Camp Plansee | 47.4870889, 10.8428833 | [Stored point](https://www.google.com/maps?q=47.4870889,10.8428833) | **Verified** | 8 m from the named “Tauchbasis Planseecamp”. Keep. |
| 41 | Nautilus | 47.9064972, 13.5670667 | [Stored point](https://www.google.com/maps?q=47.9064972,13.5670667) | **Verified** | 18 m from the current named dive place “Tauchplatz Watersports” at Weyregg; likely an older operator/site name. Keep. |
| 35 | Koversada | 45.1553722, 13.6068722 | [Stored point](https://www.google.com/maps?q=45.1553722,13.6068722) | **Plausible** | 13 m from Triton Diving at Camping Orsera, but roughly 1.5 km north of Koversada's campsite/dive centre. Keep only if this row represents the operator or departure point; otherwise review against the logbook. |
| 63 | Sataya South | 24.1571056, 35.7125250 | [Stored point](https://www.google.com/maps?q=24.1571056,35.7125250) | **Verified** | 173 m from the named Google place “Sataya Dolphin House Reef South” and similarly close to the independent dive-site marker. Keep. |
| 22 | Elphinstone | 25.3141861, 34.8596194 | [Stored point](https://www.google.com/maps?q=25.3141861,34.8596194) | **Verified** | The stored point itself is a named OpenStreetMap/Google Elphinstone dive-site marker; differing reef-centre records reflect the long reef. Keep. |
| 1 | Gorgonia Beach Housereef | 24.7061444, 35.0855278 | [Stored point](https://www.google.com/maps?q=24.7061444,35.0855278) | **Mismatch** | Stored point is about 570 m inland at the resort/road, not the house reef. Candidate named “House Reef Gorgonia”: [24.7043357, 35.0908098](https://www.google.com/maps?q=24.7043357,35.0908098). |
| 18 | Ras Torombi | 25.6612806, 34.5869056 | [Stored point](https://www.google.com/maps?q=25.6612806,34.5869056) | **Verified** | 209 m from the named “Ras Torombi reef” marker and on the same reef edge. Keep. |
| 24 | Abu Dabbab II & III | 25.3453222, 34.7670278 | [Stored point](https://www.google.com/maps?q=25.3453222,34.7670278) | **Plausible** | Roughly 1.0 km west of the mapped Abu Dabbab II and III reef centres; it may be a boat entry. Their midpoint is [25.3472973, 34.7771072](https://www.google.com/maps?q=25.3472973,34.7771072). Review before changing. |
| 23 | Abu Dabbab IV | 25.3405694, 34.7947306 | [Stored point](https://www.google.com/maps?q=25.3405694,34.7947306) | **Verified** | The stored point is a named “Abu Dabab 4” dive marker and lies about 310 m from the mapped reef centre. Keep. |
| 25 | Marsa Shouna | 25.4698889, 34.6824667 | [Stored point](https://www.google.com/maps?q=25.4698889,34.6824667) | **Verified** | 98 m from two exact-name Google records for Marsa Shouna / Shoab El Shouna. Keep. |
| 66 | Big Gotta / Gotta Kebier | 23.5572083, 36.2250833 | [Stored point](https://www.google.com/maps?q=23.5572083,36.2250833) | **Mismatch** | Stored point is near Rocky Island, about 34 km from the St. John's “Gota Kebir” record. Candidate: [23.4146981, 35.9306143](https://www.google.com/maps?q=23.4146981,35.9306143). |
| 68 | Paradise Reef | 23.5571194, 36.2261556 | [Stored point](https://www.google.com/maps?q=23.5571194,36.2261556) | **Mismatch** | Stored point is near Rocky Island, about 42 km from the named “Paradise Reef St. Johns Orabi”. Candidate: [23.6235000, 35.8217000](https://www.google.com/maps?q=23.6235000,35.8217000). |
| 19 | Big Brother | 26.3117806, 34.8467417 | [Stored point](https://www.google.com/maps?q=26.3117806,34.8467417) | **Verified** | 283 m from the mapped Big Brother Island centre and appropriately located at its reef edge. Keep. |
| 21 | Daedalus | 24.9316194, 35.8716500 | [Stored point](https://www.google.com/maps?q=24.9316194,35.8716500) | **Verified** | 148 m from the mapped Daedalus Reef marker. Keep. |
| 65 | Rocky Island | 24.1571056, 35.7125250 | [Stored point](https://www.google.com/maps?q=24.1571056,35.7125250) | **Mismatch** | Exact duplicate of Sataya South and about 85 km from Rocky Island. Island-centre candidate: [23.5636405, 36.2454635](https://www.google.com/maps?q=23.5636405,36.2454635); select the actual dive side from the log/operator route. |
| 20 | Small Brother | 26.3003694, 34.8633583 | [Stored point](https://www.google.com/maps?q=26.3003694,34.8633583) | **Verified** | 93 m from the mapped Small Brother Island point. Keep. |
| 64 | Zabargad Island | 23.5571306, 36.2262944 | [Stored point](https://www.google.com/maps?q=23.5571306,36.2262944) | **Mismatch** | Stored point is near Rocky Island and 6.7 km from Zabargad. Island-centre candidate: [23.6110648, 36.1976630](https://www.google.com/maps?q=23.6110648,36.1976630); select the actual dive side from the log/operator route. |
| 17 | Divers Indoor | 48.3085944, 11.8638306 | [Stored point](https://www.google.com/maps?q=48.3085944,11.8638306) | **Verified** | 41 m from the named “Diver's Indoor Tauchsportzentrum”. Keep. |
| 11 | Allmanshausen Wasserwacht | 47.9308333, 11.3329806 | [Stored point](https://www.google.com/maps?q=47.9308333,11.3329806) | **Verified** | 84 m from the mapped Wasserrettungsstation Seeburg on the expected shoreline. Keep. |
| 9 | Echinger Weiher | 48.3160861, 11.6177833 | [Stored point](https://www.google.com/maps?q=48.3160861,11.6177833) | **Verified** | Inside the mapped Echinger Weiher boundary, 105 m from its centre, at the northeast edge/entry. Keep. |
| 14 | Friedberger See | 48.3605944, 10.9653056 | [Stored point](https://www.google.com/maps?q=48.3605944,10.9653056) | **Verified** | 9 m from the named Tauchbasis and Wasserwacht pier. Keep. |
| 15 | Walchensee, Steinbruch | 47.5733333, 11.3536833 | [Stored point](https://www.google.com/maps?q=47.5733333,11.3536833) | **Plausible** | Correct Walchensee south-shore/road context, but no independent named underwater marker was found. Retain pending local confirmation. |
| 16 | Walchensee, ’Hackerl’ | 47.5725222, 11.3222694 | [Stored point](https://www.google.com/maps?q=47.5725222,11.3222694) | **Plausible** | Maps to the P22 south-shore parking/entry area; the exact “Hackerl” underwater point was not independently published. Retain pending local confirmation. |
| 32 | Nordturm | 49.3537667, 12.1984444 | [Stored point](https://www.google.com/maps?q=49.3537667,12.1984444) | **Verified** | 187 m west of “Parkplatz Murner See Holzturm”, placing it at the expected north-side water entry rather than in the car park. Keep. |
| 26 | Walchensee, Gallerie | 47.6054167, 11.3349639 | [Stored point](https://www.google.com/maps?q=47.6054167,11.3349639) | **Plausible** | Maps to the Kirchelwandtunnel/gallery on the Walchensee shore, consistent with the name; exact underwater entry remains unverified. Retain pending local confirmation. |
| 48 | Capo Galera, Hausriff | 40.5702167, 8.2422611 | [Stored point](https://www.google.com/maps?q=40.5702167,8.2422611) | **Verified** | 73 m from Capo Galera Diving Center in the correct house-reef entry area. Keep. |
| 61 | Cueva del Aqua | 37.5764250, -1.2198111 | [Stored point](https://www.google.com/maps?q=37.5764250,-1.2198111) | **Verified** | 24 m from the named Cueva del Agua cave record. Keep. |

## Research progress

- Full coordinate inventory: **70 / 70** database rows reviewed.
- Missing/invalid-coordinate rows captured: **42 / 42**.
- Missing rows with confirmed replacements: **23**.
- Missing rows with candidate replacements needing review: **17**.
- Missing rows still pending an exact coordinate: **2**.
- Existing coordinates verified: **18 / 28**.
- Existing coordinates plausible but needing review: **5 / 28**.
- Existing coordinate mismatches: **5 / 28**.
- Database updates applied: **23** confirmed coordinate pairs on 2026-08-31.

### Next sites to resolve

1. Consolidated B24 — obtain the position from Triton Diving or the 2024 Vrsar
   route sheet; the dive record rules out the published Medulin and Vis B-24s.
2. Pyramida Riff / Hrid Piramida and Hrid Mala Glavina — resolve the conflicting
   published positions directly with Diving Center Mihurić or a georeferenced
   chart; the public operator diagrams are not georeferenced.
3. Shaab Maksour, Small Gotta, and Abu Gushun/Hamada now have candidate map
   positions; cross-check them against an operator route sheet before import.
4. The four formerly unresolved Punta Giglio caves and Bramassa now have
   approximate positions from Alghero Divers' aerial site map. Confirm them
   against operator GPS waypoints before import, especially the two western
   markers (Pozzo and Bramassa), which lie outside the map-registration control
   points and therefore have greater uncertainty.
