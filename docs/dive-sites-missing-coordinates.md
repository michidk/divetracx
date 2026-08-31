# Dive-site coordinate research

Database snapshot: 2026-08-30 (UTC)

This is a working research document, not an import file. In the initial snapshot,
the database had 70 dive sites and 42 matched
`latitude IS NULL OR longitude IS NULL`. All 42 were missing latitude and contained
the same invalid longitude (`-170.0000000`). Their DiveMate source values were also
the same malformed pair: `189°60'0.00"N`, `170°00'0.00"W`. Both coordinates
therefore needed to be replaced together.

On 2026-08-31, 23 replacements then marked **Confirmed** were written to the
database. Subsequent second-source verification found that two of those writes
(Baron Gautsch and HMS Coriolanus) used erroneous operator-map longitudes and
need correction. Eighteen more rows were subsequently confirmed through research
but have not yet been applied. The original `source_latitude` and
`source_longitude` values were preserved for provenance. Nineteen malformed rows
remain in the database: 18 confirmed replacements and one candidate.

The 28 sites that already had populated coordinates in the initial snapshot are
audited separately below. All 28 decimal values accurately reproduce their DiveMate
degree-minute-second source text (maximum conversion difference:
`0.0000000444°`), but seven source positions identify the wrong place.

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

Triton Diving's [dive-site map](https://www.tritondiving.eu/dive-sites/) supplied
the initial Vrsar/Istria positions. Its marker code confirms that the first value
is latitude and the second longitude (the underlying custom-field labels happen
to be reversed). Second-source verification found that its Baron Gautsch and HMS
Coriolanus longitudes are wrong; the independently corroborated replacements are
used below. The Saline and Sturag markers remain geographically consistent.

| DiveMate ID | Dive site | Region | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 37 | Baron Gautsch | Istria | 44.9402778 | 13.5777778 | [44.9402778, 13.5777778](https://www.google.com/maps?q=44.9402778,13.5777778) | **Confirmed** | The [Croatian](https://hr.wikipedia.org/wiki/Baron_Gautsch) and [German](https://de.wikipedia.org/wiki/Baron_Gautsch) wreck records independently publish 44°56′25″N, 13°34′40″E, matching OpenStreetMap's [named wreck marker](https://www.openstreetmap.org/node/663869712). [Bradt's Istria guide](https://www.bradtguides.com/diving-in-istria/) independently places it at approximately 44°56.4′N, 13°34.7′E. Triton's `13.4138889` longitude is about 12.8 km west of this consistent cluster and was applied to the database before the error was found; it needs correction. |
| 36 | Consolidated B24 | Istrien | 45.1500000 | 13.5166667 | [45.1500000, 13.5166667](https://www.google.com/maps?q=45.1500000,13.5166667) | **Candidate** | [Zentacle's B-24 Liberator record](https://www.zentacle.com/Beach/9791/b-24-liberator-us-bomber) identifies a “Consolidated B-24 H” off Vrsar at 27 m and notes the propeller displayed in Vrsar. The [EU TECTONIC wreck-survey report](https://ec.europa.eu/research/participants/documents/downloadPublic?documentIds=080166e50558e82f&appId=PPGMS) independently places the B-24 H/J southwest of Vrsar at 28–30 m. The report's full 285 pages were text-checked and do not publish an exact position. The evidence matches the database dive's 30.96 m maximum depth and 15-minute Zodiac ride, but the only public coordinate found is rounded to whole arcminutes and should be treated as approximate. |
| 39 | HMS Coriolanus | Istrien | 45.3206500 | 13.3901000 | [45.3206500, 13.3901000](https://www.google.com/maps?q=45.3206500,13.3901000) | **Confirmed** | [Bradt's Istria guide](https://www.bradtguides.com/diving-in-istria/) publishes 45°19.239′N, 13°23.406′E; conversion gives this coordinate. An independently published [dive-video waypoint](https://www.youtube.com/watch?v=P9_l7s9yHFM) matches it exactly, and OpenStreetMap's older [dive-site marker](https://www.openstreetmap.org/node/663870669) is about 104 m away at 45.319722, 13.390278. Triton's `13.4236111` longitude follows a conflicting 13°25′25″ transcription and was applied to the database before the error was found; it needs correction. |
| 38 | Saline | Istrien | 45.1207796 | 13.6153865 | [45.1207796, 13.6153865](https://www.google.com/maps?q=45.1207796,13.6153865) | **Confirmed** | Exact reef marker on Triton Diving's operator map. |
| 40 | Sturag | Istrien | 45.0513924 | 13.6233687 | [45.0513924, 13.6233687](https://www.google.com/maps?q=45.0513924,13.6233687) | **Confirmed** | Exact island marker on Triton Diving's operator map. |
| 7 | Hrid Mala Giavina | Selce | 45.0502513 | 14.7441440 | [45.0502513, 14.7441440](https://www.google.com/maps?q=45.0502513,14.7441440) | **Confirmed** | Current operator spelling is [Hrid Mala Glavina](https://mihuric.hr/hrid-mala-glavina/), and this is Google's named “Reef Mala Glavina”. The independent dataset's “Glavina” point at 45.0687016, 14.7379231 is by the distinct Rt Glavina headland. [DiveNavigator's](https://www.divenavigator.com/dive-sites/croatia/hrid-mala-glavina) 45.0562, 14.7417 point instead falls on the exposed rocks independently identified as Hrid Piramida, so it appears to be misassigned. Not yet applied to the database. |
| 8 | Pyramida Riff | Selce | 45.0562000 | 14.7418000 | [45.0562000, 14.7418000](https://www.google.com/maps?q=45.0562000,14.7418000) | **Confirmed** | Matched to Mihurić's current [Hrid Piramida](https://mihuric.hr/hrid-piramida/) page, whose diagram and description show an isolated rock circled by the dive. [Dive Champ](https://divechamp.com/divesite/hrid-piramida) embeds this coordinate. It falls directly between two exposed OpenStreetMap rocks at [45.0560461, 14.7417460](https://www.openstreetmap.org/node/8524704578) and [45.0562455, 14.7417842](https://www.openstreetmap.org/node/8524704577), matching the operator diagram and satellite imagery. Not yet applied to the database. |
| 10 | Selce Riff Kamenjak | Selce | 45.0723083 | 14.7335672 | [45.0723083, 14.7335672](https://www.google.com/maps?q=45.0723083,14.7335672) | **Confirmed** | Exact “Kamenjak Languste” dive-site record in an independent Croatia dataset, 65 m from OpenStreetMap's official-source [Kamenjak islet](https://www.openstreetmap.org/way/737397543); Mihurić's [Hrid Kamenjak](https://mihuric.hr/hrid-kamenjak/) diagram confirms the paired inner/outer reef. |
| 2 | Selce D.C. Mihurić Housereef | Selce | 45.1524907 | 14.7192413 | [45.1524907, 14.7192413](https://www.google.com/maps?q=45.1524907,14.7192413) | **Confirmed** | Named Google record for Diving Center Mihurić; the operator lists this as its [House reef](https://mihuric.hr/house-reef/). |

## Egypt

Red Sea spellings vary considerably between operators. Matches below use the site
name, reef group, and the database's trip context—not name similarity alone.

| DiveMate ID | Dive site | Region | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 70 | Malahi | Fury Shoal | 24.1963800 | 35.6612000 | [24.1963800, 35.6612000](https://www.google.com/maps?q=24.1963800,35.6612000) | **Confirmed** | Exact “Malahi” record in an independent Red Sea dive-site dataset. |
| 62 | Shaab Maksour | Hamata, Fury Shoals | 24.2388110 | 35.6542264 | [24.2388110, 35.6542264](https://www.google.com/maps?q=24.2388110,35.6542264) | **Confirmed** | Exact named OpenStreetMap [Shaab Maksour South](https://www.openstreetmap.org/node/271180623) dive-entry marker. [Deep South Divers' site guide](https://deepsouthdiverseg.com/liveaboards/shaab-maksour/) gives the reef position as N 24°14.3′, E 35°39.2′ and explains that mooring is possible only at the sheltered southern tip. The dive log says “Zodiac entry” and “back at the line,” which identifies that south mooring rather than the separate north entry. Not yet applied to the database. |
| 12 | Marsa Asalaya | Marsa Alam | 25.1553587 | 34.8514471 | [25.1553587, 34.8514471](https://www.google.com/maps?q=25.1553587,34.8514471) | **Confirmed** | Named Google place “Marsa Assalaya”; independent record: 25.15527, 34.85137. |
| 13 | Marsa Samaday | Marsa Alam | 25.0125140 | 34.9259438 | [25.0125140, 34.9259438](https://www.google.com/maps?q=25.0125140,34.9259438) | **Confirmed** | Direct named Google place “Samadai Beach” at the large sandy bay. The database records a shore entry and 15.8 m maximum depth, matching operator descriptions of the gently sloping Marsa Samadai shore dive. This is intentionally not the offshore Shaab Samadai/Dolphin House marker. Not yet applied to the database. |
| 67 | Small Gotta | Saint Johns | 23.4297222 | 35.9033333 | [23.4297222, 35.9033333](https://www.google.com/maps?q=23.4297222,35.9033333) | **Confirmed** | [Red Sea Diving's Deep South guide](https://redsea-diving.com/deep-south/) publishes Gota Soraya / Small Gota at 23°25′47″N, 35°54′12″E. The converted coordinate is about 17 m from the earlier exact-name Dive Vibe dataset point, independently corroborating it. Not yet applied to the database. |
| 69 | Umm Chararim | Saint Johns | 23.6360000 | 35.8263000 | [23.6360000, 35.8263000](https://www.google.com/maps?q=23.6360000,35.8263000) | **Confirmed** | Named Google place “Cave Reef St. Johns Umm Khararim”; independent record: 23.63315, 35.82790. |
| 6 | Abu Gushun | Red Sea | 24.4383333 | 35.2131166 | [24.4383333, 35.2131166](https://www.google.com/maps?q=24.4383333,35.2131166) | **Confirmed** | The dive notes identify the Hamada wreck. [Wikivoyage's Hamada map](https://de.wikivoyage.org/wiki/Hamada) explicitly gives 24.438333, 35.213117, matching the named [OpenStreetMap wreck marker](https://www.openstreetmap.org/node/663869769); an independent coordinate directory gives 24.438356, 35.212268, about 86 m away. The conflicting 24.42, 35.25 describes the offshore casualty/sinking position rather than the final shallow wreck site. Not yet applied to the database. |
| 3 | Big Abo Galawa | Fury Shoals | 24.2280865 | 35.5738921 | [24.2280865, 35.5738921](https://www.google.com/maps?q=24.2280865,35.5738921) | **Confirmed** | Named Google place “Abu Galawa Kebir” (big). |
| 5 | Sh'aab Claudio | Fury Shoals | 24.2198492 | 35.6112986 | [24.2198492, 35.6112986](https://www.google.com/maps?q=24.2198492,35.6112986) | **Confirmed** | Named Google place “Shaab Claudio Reef”; independent record: 24.21988, 35.61210. |
| 4 | Small Abo Galawa | Fury Shoals | 24.2531790 | 35.5399491 | [24.2531790, 35.5399491](https://www.google.com/maps?q=24.2531790,35.5399491) | **Confirmed** | Named Google place “Sha'ab Abu Galawa Soraya” (small); independent record: 24.25277, 35.53920. |

## Germany

The original landmark-based candidates were replaced with coordinates from
dedicated local dive-site records. In particular, the “Kapelle” dive site is at
Seeburg/Allmannshausen, not at the Votivkapelle several kilometres north.

| DiveMate ID | Dive site | Water | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 34 | Allmanshausen Wintertauchplatz | Starnberger See | 47.9348240 | 11.3351520 | [47.9348240, 11.3351520](https://www.google.com/maps?q=47.9348240,11.3351520) | **Confirmed** | Exact coordinate published by ColdWater Films for its dedicated [Badeplatz / Wintertauchplatz (Allmannshausen)](https://coldwater-films.de/tauchspots/deutschland/starnberger-see/badeplatz-wintertauchplatz/) record. Not yet applied to the database. |
| 47 | Kapelle | Starnberger See | 47.9333940 | 11.3344090 | [47.9333940, 11.3344090](https://www.google.com/maps?q=47.9333940,11.3344090) | **Confirmed** | Exact coordinate published by ColdWater Films for [Kapelle / Seeburg (Allmannshausen)](https://coldwater-films.de/tauchspots/deutschland/starnberger-see/kapelle-seeburg/). This corrects the earlier Votivkapelle landmark candidate about 3.5 km to the north. Not yet applied to the database. |
| 33 | Leoni | Starnberger See (source says “Stanberger”) | 47.9560000 | 11.3435000 | [47.9560000, 11.3435000](https://www.google.com/maps?q=47.9560000,11.3435000) | **Confirmed** | Exact geolocation embedded in Scubago's dedicated [Leonie, Starnberger See](https://www.scubago.com/de/explore/divesite/leonie-starnberger-see-96691) dive-site record. It is about 55 m from the earlier Seehotel Leoni shoreline candidate and matches the shallow training-dive context. Not yet applied to the database. |

## Italy

The database trip used Capo Galera. The operator confirms many of the names on its
[dive-site list and map](https://www.capogalera.com/diving-spots.aspx?ver=it).
Alghero Divers' numbered [Punta Giglio aerial site map](https://www.algherodivers.com/en/punta-giglio-porto-conte)
initially supplied approximate positions. Those estimates have now been replaced
where possible by dedicated GPS dive-site records linked to local operators; the
new positions are generally within 50–270 m of the aerial-map estimates.

| DiveMate ID | Dive site | Region | Latitude | Longitude | Google Maps | Status | Evidence / note |
| ---: | --- | --- | ---: | ---: | --- | --- | --- |
| 53 | Cala Verde | Capo Caccia | 40.5630989 | 8.1645002 | [40.5630989, 8.1645002](https://www.google.com/maps?q=40.5630989,8.1645002) | **Confirmed** | Exact coordinate in Scuba Spot Advisor's dedicated [Cala Verde](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/cala-verde-1814) dive-site record, linked to Diving Alghero and other local operators. The cave/air-pocket context matches the database notes. Not yet applied to the database. |
| 49 | Grotta della Madonnina | Capo Caccia | 40.5602825 | 8.1638158 | [40.5602825, 8.1638158](https://www.google.com/maps?q=40.5602825,8.1638158) | **Confirmed** | Direct named Google natural-feature record; also on the [Capo Galera site list](https://www.capogalera.com/diving-spot/3/grotta-della-madonnina/it). |
| 54 | Grotta di Nereo | Capo Caccia | 40.5616595 | 8.1611888 | [40.5616595, 8.1611888](https://www.google.com/maps?q=40.5616595,8.1611888) | **Confirmed** | Direct named Google natural-feature record; also on the [Capo Galera site list](https://www.capogalera.com/diving-spot/2/grotta-di-nereo/it). |
| 56 | Il Tunnel & Grotta de Cabriol | Capo Caccia | 40.5625000 | 8.1618996 | [40.5625000, 8.1618996](https://www.google.com/maps?q=40.5625000,8.1618996) | **Confirmed** | Uses the first-named site's exact [Il Tunnel](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/il-tunnel-1816) GPS record. The same catalogue independently places [Grotta del Cabirol](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/grotta-del-cabirol-1815) about 112 m north at [40.5634995, 8.1618004](https://www.google.com/maps?q=40.5634995,8.1618004), explaining why the two nearby sites were combined in one logged dive. Not yet applied to the database. |
| 58 | Porticato | Capo Caccia | 40.5680008 | 8.1576004 | [40.5680008, 8.1576004](https://www.google.com/maps?q=40.5680008,8.1576004) | **Confirmed** | Exact coordinate in the dedicated [Il Porticato](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/il-porticato-1818) dive-site record, consistent with [Capo Galera's description](https://www.capogalera.com/diving-spot/7/il-porticato/it) beneath Capo Caccia near the Nereo cave complex. Not yet applied to the database. |
| 60 | Dolmen | Isola Foradada | 40.5722008 | 8.1528997 | [40.5722008, 8.1528997](https://www.google.com/maps?q=40.5722008,8.1528997) | **Confirmed** | Exact coordinate in the dedicated [Isola Foradada Dolmen](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/isola-foradada-dolmen-1820) dive-site record. This replaces the earlier island-centre marker. Not yet applied to the database. |
| 51 | Grotta dei Cervi | Punta Giglio | 40.5681912 | 8.2041873 | [40.5681912, 8.2041873](https://www.google.com/maps?q=40.5681912,8.2041873) | **Confirmed** | Direct named Google natural-feature record; also on the [Capo Galera site list](https://www.capogalera.com/diving-spot/5/grotta-dei-cervi/it). |
| 52 | Grotta dei Falco | Punta Giglio | 40.5695000 | 8.2208996 | [40.5695000, 8.2208996](https://www.google.com/maps?q=40.5695000,8.2208996) | **Confirmed** | Database spelling is plural; Alghero Divers calls it [Ennio Falco's Cave / Amphitrite](https://www.algherodivers.com/en/2-grotta-di-e-falco). The exact coordinate comes from the dedicated [Grotta di Falco](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/grotta-di-falco-1803) dive-site record. Not yet applied to the database. |
| 57 | Grotta dei Fantasmi | Punta Giglio | 40.5698013 | 8.2065001 | [40.5698013, 8.2065001](https://www.google.com/maps?q=40.5698013,8.2065001) | **Confirmed** | Exact coordinate in the dedicated [Grotta dei Fantasmi](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/grotta-dei-fantasmi-1805) dive-site record; both [Capo Galera](https://www.capogalera.com/diving-spot/4/grotta-dei-fantasmi/it) and [Alghero Divers](https://www.algherodivers.com/en/4-grotta-dei-fantasmi) independently confirm the site. Not yet applied to the database. |
| 55 | Grotta del Pozzo | Punta Giglio | 40.5719100 | 8.1977800 | [40.5719100, 8.1977800](https://www.google.com/maps?q=40.5719100,8.1977800) | **Confirmed** | Exact coordinate published by PADI's [Pozzo Cave](https://www.padi.com/dive-site/italy/pozzo-cave/) record. Its route description and [Alghero Divers' site page](https://www.algherodivers.com/en/6-grotta-del-pozzo) match the database dive and place it just inside Porto Conte Bay. Not yet applied to the database. |
| 59 | Grotta delle Stalattiti | Punta Giglio | 40.5704994 | 8.2077999 | [40.5704994, 8.2077999](https://www.google.com/maps?q=40.5704994,8.2077999) | **Confirmed** | Exact coordinate in the dedicated [Grotta delle Stalattiti](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/grotta-delle-stalattiti-1804) dive-site record. [Alghero Divers' site page](https://www.algherodivers.com/en/3-grotta-delle-stalattiti) independently confirms the cave and its 7 m entrance. Not yet applied to the database. |
| 50 | La Bramassa | Punta Giglio | 40.5750008 | 8.1976004 | [40.5750008, 8.1976004](https://www.google.com/maps?q=40.5750008,8.1976004) | **Confirmed** | Exact coordinate in the dedicated [La Bramassa](https://www.scubaspotadvisor.com/en/diving-spots/italy/alghero/la-bramassa-1808) record. Its description of numerous arches, walls, and a large cave at 8 m closely matches the database notes (“lots of caves”) and the logged 12.4–16.7 m depths. This is distinct from the farther north Cala della Bramassa surface feature. Not yet applied to the database. |

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
| 35 | Koversada | 45.1553722, 13.6068722 | [Stored point](https://www.google.com/maps?q=45.1553722,13.6068722) | **Mismatch** | Stored point is Triton Diving at Camping Orsera, not Koversada. The database log explicitly says “FKK beach,” shore entry, poor visibility for the first 5 m, then reef. Confirmed replacement: [45.1345800, 13.6188700](https://www.google.com/maps?q=45.1345800,13.6188700), PADI's exact [Koversada dive-site](https://www.padi.com/dive-site/croatia/koversada/) coordinate at the naturist campsite and Lim Fjord entrance. |
| 63 | Sataya South | 24.1571056, 35.7125250 | [Stored point](https://www.google.com/maps?q=24.1571056,35.7125250) | **Verified** | 173 m from the named Google place “Sataya Dolphin House Reef South” and similarly close to the independent dive-site marker. Keep. |
| 22 | Elphinstone | 25.3141861, 34.8596194 | [Stored point](https://www.google.com/maps?q=25.3141861,34.8596194) | **Verified** | The stored point itself is a named OpenStreetMap/Google Elphinstone dive-site marker; differing reef-centre records reflect the long reef. Keep. |
| 1 | Gorgonia Beach Housereef | 24.7061444, 35.0855278 | [Stored point](https://www.google.com/maps?q=24.7061444,35.0855278) | **Mismatch** | Stored point is about 550 m inland at the resort/road. Confirmed replacement: [24.7061577, 35.0909348](https://www.google.com/maps?q=24.7061577,35.0909348), the entry in [Divers Guide's dedicated Gorgonia Beach Resort record](https://www.divers-guide.com/en/gorgonia-beach-resort). Its logs explicitly describe dives on both the north and south house reefs, matching this row's many shore, night, training, north, and south dives. |
| 18 | Ras Torombi | 25.6612806, 34.5869056 | [Stored point](https://www.google.com/maps?q=25.6612806,34.5869056) | **Verified** | 209 m from the named “Ras Torombi reef” marker and on the same reef edge. Keep. |
| 24 | Abu Dabbab II & III | 25.3453222, 34.7670278 | [Stored point](https://www.google.com/maps?q=25.3453222,34.7670278) | **Mismatch** | Stored point is about 1 km west of the reefs. The [Egyptian Chamber of Diving and Water Sports directory](https://www.cdws.travel/divesites) independently places Abu Dabbab 2 at 25.3472547, 34.7768748 and Abu Dabbab 3 at 25.3442454, 34.7773350. Confirmed representative replacement: [25.3470650, 34.7765150](https://www.google.com/maps?q=25.3470650,34.7765150), the geotag on a [Heaven One wreck photograph](https://commons.wikimedia.org/wiki/File:Wreck_of_Heaven_One,_Abu_Dabab.jpg), about 40 m from the official Reef 2 point. The latest database dive explicitly records “Heaven I wreck.” |
| 23 | Abu Dabbab IV | 25.3405694, 34.7947306 | [Stored point](https://www.google.com/maps?q=25.3405694,34.7947306) | **Verified** | The stored point is a named “Abu Dabab 4” dive marker and lies about 310 m from the mapped reef centre. Keep. |
| 25 | Marsa Shouna | 25.4698889, 34.6824667 | [Stored point](https://www.google.com/maps?q=25.4698889,34.6824667) | **Verified** | 98 m from two exact-name Google records for Marsa Shouna / Shoab El Shouna. Keep. |
| 66 | Big Gotta / Gotta Kebier | 23.5572083, 36.2250833 | [Stored point](https://www.google.com/maps?q=23.5572083,36.2250833) | **Mismatch** | Stored point is near Rocky Island, about 34 km from St. John's Gota Kebir. Confirmed replacement: [23.4147222, 35.9305556](https://www.google.com/maps?q=23.4147222,35.9305556), converted from the 23°24′53″N, 35°55′50″E waypoint published by [Red Sea Diving](https://redsea-diving.com/deep-south/). Its description of tunnels matches the database site's “2 tunnels” note and 22.9 m dive. |
| 68 | Paradise Reef | 23.5571194, 36.2261556 | [Stored point](https://www.google.com/maps?q=23.5571194,36.2261556) | **Mismatch** | Stored point is near Rocky Island, about 42 km from the direct named Google record “Paradise Reef St. Johns Orabi”. Confirmed replacement: [23.6235000, 35.8217000](https://www.google.com/maps?q=23.6235000,35.8217000). A review on that exact place record describes a night dive with small tunnels; the database likewise records a night dive with 30 minutes in a cavern. |
| 19 | Big Brother | 26.3117806, 34.8467417 | [Stored point](https://www.google.com/maps?q=26.3117806,34.8467417) | **Verified** | 283 m from the mapped Big Brother Island centre and appropriately located at its reef edge. Keep. |
| 21 | Daedalus | 24.9316194, 35.8716500 | [Stored point](https://www.google.com/maps?q=24.9316194,35.8716500) | **Verified** | 148 m from the mapped Daedalus Reef marker. Keep. |
| 65 | Rocky Island | 24.1571056, 35.7125250 | [Stored point](https://www.google.com/maps?q=24.1571056,35.7125250) | **Mismatch** | Exact duplicate of Sataya South and about 85 km from Rocky Island. Confirmed replacement: [23.5614949, 36.2444793](https://www.google.com/maps?q=23.5614949,36.2444793), the official “Rocky island” point in the [Egyptian Chamber of Diving and Water Sports directory](https://www.cdws.travel/divesites). The database name does not specify a side, so the official general dive-site position is preferable to inventing an entry point. |
| 20 | Small Brother | 26.3003694, 34.8633583 | [Stored point](https://www.google.com/maps?q=26.3003694,34.8633583) | **Verified** | 93 m from the mapped Small Brother Island point. Keep. |
| 64 | Zabargad Island | 23.5571306, 36.2262944 | [Stored point](https://www.google.com/maps?q=23.5571306,36.2262944) | **Mismatch** | Stored point is near Rocky Island and 6.7 km from Zabargad. Confirmed replacement: [23.5915000, 36.1967500](https://www.google.com/maps?q=23.5915000,36.1967500), the official “Zabargad island” dive-site point in the [Egyptian Chamber of Diving and Water Sports directory](https://www.cdws.travel/divesites). It lies on the island's southwest dive coast rather than at the landmass centre. |
| 17 | Divers Indoor | 48.3085944, 11.8638306 | [Stored point](https://www.google.com/maps?q=48.3085944,11.8638306) | **Verified** | 41 m from the named “Diver's Indoor Tauchsportzentrum”. Keep. |
| 11 | Allmanshausen Wasserwacht | 47.9308333, 11.3329806 | [Stored point](https://www.google.com/maps?q=47.9308333,11.3329806) | **Verified** | 84 m from the mapped Wasserrettungsstation Seeburg on the expected shoreline. Keep. |
| 9 | Echinger Weiher | 48.3160861, 11.6177833 | [Stored point](https://www.google.com/maps?q=48.3160861,11.6177833) | **Verified** | Inside the mapped Echinger Weiher boundary, 105 m from its centre, at the northeast edge/entry. Keep. |
| 14 | Friedberger See | 48.3605944, 10.9653056 | [Stored point](https://www.google.com/maps?q=48.3605944,10.9653056) | **Verified** | 9 m from the named Tauchbasis and Wasserwacht pier. Keep. |
| 15 | Walchensee, Steinbruch | 47.5733333, 11.3536833 | [Stored point](https://www.google.com/maps?q=47.5733333,11.3536833) | **Verified** | About 50 m from the exact 47.573349, 11.354324 coordinate in ColdWater Films' dedicated [Steinbruch](https://coldwater-films.de/tauchspots/deutschland/walchensee/steinbruch/) record. Its stair entry and greater-than-40 m depth match the repeated 31–35 m shore dives. Keep. |
| 16 | Walchensee, ’Hackerl’ | 47.5725222, 11.3222694 | [Stored point](https://www.google.com/maps?q=47.5725222,11.3222694) | **Verified** | About 16 m from ColdWater Films' exact “Hackl” coordinate, 47.572668, 11.322236, on its [Walchensee dive-site overview](https://coldwater-films.de/tauchspots/deutschland/walchensee/). The separately described VW Beetle lies at 10–15 m, consistent with the database's shallow 15–18 m dives. Keep. |
| 32 | Nordturm | 49.3537667, 12.1984444 | [Stored point](https://www.google.com/maps?q=49.3537667,12.1984444) | **Verified** | 187 m west of “Parkplatz Murner See Holzturm”, placing it at the expected north-side water entry rather than in the car park. Keep. |
| 26 | Walchensee, Gallerie | 47.6054167, 11.3349639 | [Stored point](https://www.google.com/maps?q=47.6054167,11.3349639) | **Verified** | About 24 m from the 47.6053, 11.3347 geolocation embedded in Scubago's dedicated [Walchensee, Galerie](https://www.scubago.com/de/explore/divesite/walchensee-galerie-1467) record. That record describes a guide line to a car wreck at about 35 m; the database log says “saw car” on a 37.47 m dive. Keep. |
| 48 | Capo Galera, Hausriff | 40.5702167, 8.2422611 | [Stored point](https://www.google.com/maps?q=40.5702167,8.2422611) | **Verified** | 73 m from Capo Galera Diving Center in the correct house-reef entry area. Keep. |
| 61 | Cueva del Aqua | 37.5764250, -1.2198111 | [Stored point](https://www.google.com/maps?q=37.5764250,-1.2198111) | **Verified** | 24 m from the named Cueva del Agua cave record. Keep. |

## Research progress

- Full coordinate inventory: **70 / 70** database rows reviewed.
- Missing/invalid-coordinate rows captured: **42 / 42**.
- Missing rows with confirmed replacements: **41**.
- Missing rows with candidate replacements needing review: **1**.
- Missing rows still pending an exact coordinate: **0**.
- Existing coordinates verified: **21 / 28**.
- Existing coordinates plausible but needing review: **0 / 28**.
- Existing coordinate mismatches: **7 / 28**.
- Existing-coordinate mismatches with confirmed replacements: **7 / 7**.
- Database updates currently matching research: **21 / 41** confirmed coordinate
  pairs. Twenty-three writes were made on 2026-08-31, but IDs 37 and 39 need
  correction after second-source verification.
- Existing-coordinate corrections applied: **0 / 7**.

### Next sites to resolve

1. Consolidated B24 is the only missing-coordinate row that remains a candidate.
   The only public position found is rounded to whole arcminutes, and the EU survey
   omits an exact coordinate; obtain a higher-precision waypoint from Triton Diving
   or the Croatian wreck authorities.
2. Correct the two previously applied operator-map errors: ID 37 Baron Gautsch and
   ID 39 HMS Coriolanus.
3. Apply the 18 newly confirmed coordinate pairs only after reviewing this second
   research batch; the database still contains the original malformed values for
   those rows.
4. Review and apply the seven confirmed replacements in the existing-coordinate
   audit separately from the missing-coordinate batch.
