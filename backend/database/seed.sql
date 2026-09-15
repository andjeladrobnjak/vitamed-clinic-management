USE vitamed;

SET NAMES utf8mb4;

SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- SPECIALTIES
-- INSERT IGNORE skips rows that already exist (unique name)
-- =====================================================

INSERT IGNORE INTO specialties (name) VALUES
    ('Kardiologija'),
    ('Pulmologija'),
    ('Endokrinologija'),
    ('Ginekologija'),
    ('Pedijatrija'),
    ('Oftalmologija'),
    ('Otorinolaringologija (ORL)'),
    ('Hirurgija');

-- Existing specialties are matched by name so reruns do not create duplicates
UPDATE specialties
SET
    description = 'Kardiologija je oblast medicine posvećena prevenciji, dijagnostici i lečenju bolesti srca i krvnih sudova. U VitaMed klinici dostupni su specijalistički pregledi i savremene dijagnostičke procedure prilagođene individualnim potrebama pacijenata.',
    image_url = '/images/specialties/cardiology.jpg'
WHERE name = 'Kardiologija';

UPDATE specialties
SET
    description = 'Pulmologija se bavi prevencijom, dijagnostikom i lečenjem bolesti pluća i disajnih puteva. Specijalističkim pregledima i funkcionalnom dijagnostikom omogućavamo pravovremenu procenu respiratornog zdravlja i odgovarajuće dalje lečenje.',
    image_url = '/images/specialties/pulmonology.jpg'
WHERE name = 'Pulmologija';

UPDATE specialties
SET
    description = 'Endokrinologija je posvećena dijagnostici i lečenju poremećaja rada žlezda sa unutrašnjim lučenjem i hormonskog sistema. Posebnu pažnju posvećujemo bolestima štitaste žlezde, metaboličkim poremećajima i individualnom praćenju pacijenata.',
    image_url = '/images/specialties/endocrinology.jpg'
WHERE name = 'Endokrinologija';

UPDATE specialties
SET
    description = 'Ginekologija je usmerena na očuvanje i unapređenje reproduktivnog zdravlja žene u svim životnim dobima. Redovni pregledi, ultrazvučna dijagnostika i preventivne procedure omogućavaju rano otkrivanje promena i pravovremenu terapiju.',
    image_url = '/images/specialties/gynecology.jpg'
WHERE name = 'Ginekologija';

UPDATE specialties
SET
    description = 'Pedijatrija pruža sveobuhvatnu zdravstvenu zaštitu dece i adolescenata, od preventivnih i sistematskih pregleda do dijagnostike i lečenja akutnih i hroničnih stanja. Naš pristup prilagođen je potrebama deteta i njegove porodice.',
    image_url = '/images/specialties/pediatrics.jpg'
WHERE name = 'Pedijatrija';

UPDATE specialties
SET
    description = 'Oftalmologija se bavi očuvanjem zdravlja očiju, dijagnostikom poremećaja vida i lečenjem očnih oboljenja. Detaljnim pregledima i odgovarajućom dijagnostikom omogućavamo pravovremeno otkrivanje promena i praćenje zdravlja vida.',
    image_url = '/images/specialties/ophthalmology.jpg'
WHERE name = 'Oftalmologija';

UPDATE specialties
SET
    description = 'Otorinolaringologija obuhvata dijagnostiku i lečenje oboljenja uha, nosa i grla, kao i poremećaja sluha. Specijalistički pregledi i dodatna dijagnostika omogućavaju preciznu procenu tegoba i izbor odgovarajućeg lečenja.',
    image_url = '/images/specialties/otorhinolaryngology.jpg'
WHERE name = 'Otorinolaringologija (ORL)';

UPDATE specialties
SET
    description = 'Hirurgija obuhvata specijalističku procenu, praćenje i lečenje stanja koja zahtevaju hirurški pristup. Pored pregleda i kontrola, u VitaMed klinici dostupne su manje hirurške intervencije i postupci zbrinjavanja rana.',
    image_url = '/images/specialties/surgery.jpg'
WHERE name = 'Hirurgija';

-- =====================================================
-- SERVICES
-- specialty_id is resolved by specialty name, not by a hardcoded id
-- INSERT IGNORE skips rows that already exist (unique name + specialty)
-- =====================================================

INSERT IGNORE INTO services (name, description, price, duration_minutes, specialty_id)
VALUES
    (
        'Kardiološki pregled',
        'Prvi kardiološki pregled sa uzimanjem anamneze, fizikalnim pregledom i procenom rizika za kardiovaskularne bolesti.',
        6500.00,
        40,
        (SELECT id FROM specialties WHERE name = 'Kardiologija')
    ),
    (
        'Kontrolni kardiološki pregled',
        'Kontrolni pregled za praćenje terapije, simptoma i nalaza nakon ranije postavljene dijagnoze ili započetog lečenja.',
        4500.00,
        25,
        (SELECT id FROM specialties WHERE name = 'Kardiologija')
    ),
    (
        'EKG',
        'Elektrokardiografski snimak srca u miru, radi procene srčanog ritma i osnovne električne aktivnosti miokarda.',
        2000.00,
        15,
        (SELECT id FROM specialties WHERE name = 'Kardiologija')
    ),
    (
        'Ehokardiografija',
        'Ultrazvučni pregled srca koji procenjuje veličinu srčanih šupljina, funkciju srca i stanje srčanih zalistaka.',
        8000.00,
        35,
        (SELECT id FROM specialties WHERE name = 'Kardiologija')
    ),
    (
        'Holter EKG-a',
        'Postavljanje i tumačenje 24-časovnog Holter EKG monitoringa radi otkrivanja poremećaja ritma tokom uobičajenih dnevnih aktivnosti.',
        7500.00,
        25,
        (SELECT id FROM specialties WHERE name = 'Kardiologija')
    ),
    (
        'Pulmološki pregled',
        'Prvi pulmološki pregled sa anamnezom, auskultacijom pluća i procenom respiratornih tegoba.',
        6000.00,
        35,
        (SELECT id FROM specialties WHERE name = 'Pulmologija')
    ),
    (
        'Kontrolni pulmološki pregled',
        'Kontrolni pregled za praćenje hroničnih plućnih tegoba, terapije i ranije urađenih dijagnostičkih nalaza.',
        4200.00,
        25,
        (SELECT id FROM specialties WHERE name = 'Pulmologija')
    ),
    (
        'Spirometrija',
        'Funkcionalni test pluća koji meri volumen i protok vazduha i pomaže u proceni astme, HOBP-a i drugih respiratornih poremećaja.',
        3200.00,
        20,
        (SELECT id FROM specialties WHERE name = 'Pulmologija')
    ),
    (
        'Endokrinološki pregled',
        'Prvi endokrinološki pregled sa procenom hormonskog statusa, tegoba štitaste žlezde, metabolizma i drugih endokrinih poremećaja.',
        6200.00,
        40,
        (SELECT id FROM specialties WHERE name = 'Endokrinologija')
    ),
    (
        'Kontrolni endokrinološki pregled',
        'Kontrolni pregled za praćenje laboratorijskih nalaza, terapije i hroničnih endokrinoloških stanja.',
        4300.00,
        25,
        (SELECT id FROM specialties WHERE name = 'Endokrinologija')
    ),
    (
        'Ultrazvuk štitaste žlezde',
        'Ultrazvučni pregled štitaste žlezde radi ocene veličine, strukture i eventualnih čvorova ili drugih promena.',
        3800.00,
        20,
        (SELECT id FROM specialties WHERE name = 'Endokrinologija')
    ),
    (
        'Ginekološki pregled',
        'Prvi ginekološki pregled sa anamnezom, kliničkim pregledom i procenom ginekološkog zdravlja.',
        5500.00,
        30,
        (SELECT id FROM specialties WHERE name = 'Ginekologija')
    ),
    (
        'Kontrolni ginekološki pregled',
        'Kontrolni pregled za praćenje terapije, nalaza ili tegoba nakon ranijeg ginekološkog pregleda.',
        4000.00,
        20,
        (SELECT id FROM specialties WHERE name = 'Ginekologija')
    ),
    (
        'Ginekološki ultrazvuk',
        'Ultrazvučni pregled male karlice radi procene materice, jajnika i drugih ginekoloških nalaza.',
        4500.00,
        25,
        (SELECT id FROM specialties WHERE name = 'Ginekologija')
    ),
    (
        'PAPA test',
        'Uzimanje cervikalnog brisa (PAPA test) u svrhu ranog otkrivanja premalignih i malignih promena grlića materice.',
        2800.00,
        15,
        (SELECT id FROM specialties WHERE name = 'Ginekologija')
    ),
    (
        'Kolposkopija',
        'Kolposkopski pregled grlića materice radi detaljnije procene promena uočenih na pregledu ili PAPA testu.',
        5000.00,
        25,
        (SELECT id FROM specialties WHERE name = 'Ginekologija')
    ),
    (
        'Pedijatrijski pregled',
        'Prvi pedijatrijski pregled deteta sa anamnezom, fizikalnim pregledom i procenom opšteg zdravstvenog stanja.',
        5000.00,
        30,
        (SELECT id FROM specialties WHERE name = 'Pedijatrija')
    ),
    (
        'Kontrolni pedijatrijski pregled',
        'Kontrolni pregled deteta radi praćenja rasta, tegoba, terapije ili prethodno uočenih nalaza.',
        3800.00,
        20,
        (SELECT id FROM specialties WHERE name = 'Pedijatrija')
    ),
    (
        'Sistematski pregled dece',
        'Širi sistematski pregled deteta sa procenom rasta, razvoja i opšteg zdravlja, namenjen redovnom praćenju.',
        6500.00,
        45,
        (SELECT id FROM specialties WHERE name = 'Pedijatrija')
    ),
    (
        'Oftalmološki pregled',
        'Kompletan oftalmološki pregled vida i prednjeg segmenta oka, sa procenom tegoba i potrebe za daljom dijagnostikom.',
        5200.00,
        30,
        (SELECT id FROM specialties WHERE name = 'Oftalmologija')
    ),
    (
        'Određivanje dioptrije',
        'Objektivno i subjektivno određivanje dioptrije radi korekcije vida naočarima ili kontaktnim sočivima.',
        3000.00,
        20,
        (SELECT id FROM specialties WHERE name = 'Oftalmologija')
    ),
    (
        'Merenje očnog pritiska',
        'Merenje intraokularnog pritiska u okviru procene rizika za glaukom i praćenja očnog zdravlja.',
        1800.00,
        10,
        (SELECT id FROM specialties WHERE name = 'Oftalmologija')
    ),
    (
        'Pregled očnog dna',
        'Oftalmoskopski pregled očnog dna radi procene mrežnjače, vidnog živca i krvnih sudova oka.',
        3500.00,
        20,
        (SELECT id FROM specialties WHERE name = 'Oftalmologija')
    ),
    (
        'ORL pregled',
        'Prvi pregled uha, grla i nosa sa anamnezom i kliničkom procenom otorinolaringoloških tegoba.',
        5500.00,
        30,
        (SELECT id FROM specialties WHERE name = 'Otorinolaringologija (ORL)')
    ),
    (
        'Kontrolni ORL pregled',
        'Kontrolni ORL pregled za praćenje terapije, infekcija gornjih disajnih puteva ili ranijih nalaza.',
        4000.00,
        20,
        (SELECT id FROM specialties WHERE name = 'Otorinolaringologija (ORL)')
    ),
    (
        'Audiometrija',
        'Ispitivanje sluha audiometrijom radi procene oštrine sluha i eventualnog gubitka sluha.',
        3800.00,
        25,
        (SELECT id FROM specialties WHERE name = 'Otorinolaringologija (ORL)')
    ),
    (
        'Timpanometrija',
        'Objektivno ispitivanje funkcije srednjeg uha i pokretljivosti bubne opne, često uz procenu sluha.',
        2800.00,
        15,
        (SELECT id FROM specialties WHERE name = 'Otorinolaringologija (ORL)')
    ),
    (
        'Hirurški pregled',
        'Prvi hirurški pregled sa anamnezom, kliničkom procenom i preporukom daljeg lečenja ili intervencije.',
        5800.00,
        30,
        (SELECT id FROM specialties WHERE name = 'Hirurgija')
    ),
    (
        'Kontrolni hirurški pregled',
        'Kontrolni pregled nakon hirurške intervencije ili ranijeg pregleda, radi praćenja zarastanja i tegoba.',
        4000.00,
        20,
        (SELECT id FROM specialties WHERE name = 'Hirurgija')
    ),
    (
        'Previjanje rane',
        'Sterilno previjanje rane sa procenom zarastanja i preporukom dalje nege.',
        2000.00,
        15,
        (SELECT id FROM specialties WHERE name = 'Hirurgija')
    ),
    (
        'Uklanjanje konaca',
        'Uklanjanje hirurških konaca uz pregled rane i savet o daljoj nezi ožiljka.',
        2200.00,
        15,
        (SELECT id FROM specialties WHERE name = 'Hirurgija')
    ),
    (
        'Manje hirurške intervencije',
        'Manja ambulantna hirurška intervencija, kao što je uklanjanje manjih kožnih promena, uz lokalnu anesteziju po potrebi.',
        12000.00,
        40,
        (SELECT id FROM specialties WHERE name = 'Hirurgija')
    );

-- =====================================================
-- DOCTORS
-- specialty_id is resolved by specialty name, not by a hardcoded id
-- Inserts are skipped when first_name + last_name already exist
-- (doctors table has no UNIQUE constraint, so INSERT IGNORE would not help)
-- =====================================================

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Aleksandar',
    'Petrović',
    s.id,
    'Dr Aleksandar Petrović bavi se opštom kardiologijom, sa posebnim interesovanjem za EKG i ehokardiografiju. U svakodnevnom radu procenjuje simptome, ritam i funkciju srca i predlaže dalju dijagnostiku kada je to potrebno. Pacijentima pristupa smireno i jasno objašnjava nalaze.',
    '/images/doctors/aleksandar-petrovic.png'
FROM specialties s
WHERE s.name = 'Kardiologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Aleksandar' AND d.last_name = 'Petrović'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Jelena',
    'Marković',
    s.id,
    'U fokusu rada dr Jelene Marković su poremećaji srčanog ritma i Holter EKG monitoring. Pomaže pacijentima da razumeju simptome kao što su palpitacije, vrtoglavica ili neredovan puls. Pregled i tumačenje 24-časovnog snimanja usmerava ka praktičnim preporukama za dalje praćenje.',
    '/images/doctors/jelena-markovic.png'
FROM specialties s
WHERE s.name = 'Kardiologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Jelena' AND d.last_name = 'Marković'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Nikola',
    'Jovanović',
    s.id,
    'Dr Nikola Jovanović se bavi pulmologijom, pre svega astmom, HOBP-om i spirometrijom. Kroz razgovor i funkcionalno ispitivanje pluća procenjuje stepen tegoba i odgovor na terapiju. Cilj mu je da pacijenti dobiju jasan plan praćenja disajnih tegoba.',
    '/images/doctors/nikola-jovanovic.png'
FROM specialties s
WHERE s.name = 'Pulmologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Nikola' AND d.last_name = 'Jovanović'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Milica',
    'Stojanović',
    s.id,
    'Rad dr Milice Stojanović usmeren je na respiratorne infekcije i hronične plućne bolesti. Pažljivo razlikuje akutne tegobe od stanja koja zahtevaju duže praćenje. Pacijentima objašnjava kada je dovoljna kontrola, a kada je potrebna dodatna dijagnostika.',
    NULL
FROM specialties s
WHERE s.name = 'Pulmologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Milica' AND d.last_name = 'Stojanović'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Ana',
    'Ilić',
    s.id,
    'Dr Ana Ilić se bavi poremećajima štitaste žlezde i ultrazvučnom dijagnostikom tireoidee. Pregledom i ultrazvukom procenjuje strukturu žlezde i usklađuje nalaze sa tegobama pacijenta. Posebno vodi računa da preporuke budu razumljive i prilagođene daljem praćenju.',
    '/images/doctors/ana-ilic.png'
FROM specialties s
WHERE s.name = 'Endokrinologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Ana' AND d.last_name = 'Ilić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Stefan',
    'Nikolić',
    s.id,
    'Dr Stefan Nikolić radi sa metaboličkim i hormonskim poremećajima, od tegoba vezanih za energetski metabolizam do širih endokrinoloških nalaza. Prilikom pregleda povezuje simptome, laboratoriju i kliničku sliku. Terapiju i kontrole predlaže postepeno, u skladu sa stanjem pacijenta.',
    NULL
FROM specialties s
WHERE s.name = 'Endokrinologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Stefan' AND d.last_name = 'Nikolić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Marija',
    'Đorđević',
    s.id,
    'Dr Marija Đorđević se bavi preventivnim ginekološkim pregledima, PAPA testom i kolposkopijom. Naglasak stavlja na rano uočavanje promena i miran, diskretan tok pregleda. Pacijentkinjama objašnjava značaj redovnih kontrola i sledeće korake ako nalaz to zahteva.',
    '/images/doctors/marija-djordjevic.png'
FROM specialties s
WHERE s.name = 'Ginekologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Marija' AND d.last_name = 'Đorđević'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Katarina',
    'Pavlović',
    s.id,
    'U praksi dr Katarine Pavlović spojeni su opšta ginekologija i ginekološka ultrazvučna dijagnostika. Ultrazvukom male karlice dopunjuje klinički pregled kada je potrebna jasnija procena. Pristup joj je stručan i smiren, sa pažnjom na pitanja pacijentkinja.',
    NULL
FROM specialties s
WHERE s.name = 'Ginekologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Katarina' AND d.last_name = 'Pavlović'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Tamara',
    'Milošević',
    s.id,
    'Dr Tamara Milošević bavi se opštom pedijatrijom i sistematskim pregledima dece. Prati rast, razvoj i uobičajene dečje tegobe, uz razgovor sa roditeljima o svakodnevnoj nezi. Pregled vodi strpljivo, kako bi dete i porodica bili što opušteniji.',
    '/images/doctors/tamara-milosevic.png'
FROM specialties s
WHERE s.name = 'Pedijatrija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Tamara' AND d.last_name = 'Milošević'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Luka',
    'Savić',
    s.id,
    'Rad dr Luke Savića usmeren je na praćenje rasta i razvoja dece, uz opštu pedijatrijsku procenu. Roditeljima pomaže da razumeju šta je u okviru očekivanog razvoja, a šta zaslužuje kontrolu. Kontrole prilagođava uzrastu deteta i razlogu dolaska.',
    NULL
FROM specialties s
WHERE s.name = 'Pedijatrija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Luka' AND d.last_name = 'Savić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Ivana',
    'Ristić',
    s.id,
    'Dr Ivana Ristić se bavi opštom oftalmologijom i određivanjem dioptrije. Pregledom procenjuje vidnu oštrinu i potrebu za korekcijom naočarima ili sočivima. Pacijentima objašnjava nalaz jednostavno i predlaže kontrolu kada je to opravdano.',
    '/images/doctors/ivana-ristic.png'
FROM specialties s
WHERE s.name = 'Oftalmologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Ivana' AND d.last_name = 'Ristić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Marko',
    'Vasić',
    s.id,
    'Dr Marko Vasić u oftalmologiji posebno prati merenje očnog pritiska i pregled očnog dna, uz opštu procenu vida. Ovi pregledi pomažu u ranom uočavanju promena koje pacijent često ne oseća. Nakon pregleda daje jasne preporuke za praćenje ili dalju dijagnostiku.',
    NULL
FROM specialties s
WHERE s.name = 'Oftalmologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Marko' AND d.last_name = 'Vasić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Nevena',
    'Popović',
    s.id,
    'Dr Nevena Popović bavi se opštom otorinolaringologijom i audiometrijom. Pregledom uha, grla i nosa procenjuje tegobe kao što su bol, zapušenost ili otežano disanje na nos. Ispitivanje sluha uključuje kada anamneza i klinički nalaz to ukazuju.',
    NULL
FROM specialties s
WHERE s.name = 'Otorinolaringologija (ORL)'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Nevena' AND d.last_name = 'Popović'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Filip',
    'Lukić',
    s.id,
    'U radu dr Filipa Lukića naglasak je na tegobama uha, dijagnostici sluha i timpanometriji. Kombinuje klinički pregled sa objektivnim ispitivanjem srednjeg uha kada je to potrebno. Pacijentima objašnjava razliku između prolaznih tegoba i stanja koja zahtevaju praćenje.',
    '/images/doctors/filip-lukic.png'
FROM specialties s
WHERE s.name = 'Otorinolaringologija (ORL)'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Filip' AND d.last_name = 'Lukić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Miloš',
    'Kovačević',
    s.id,
    'Dr Miloš Kovačević se bavi opštom hirurgijom i manjim ambulantnim hirurškim intervencijama. Pregledom procenjuje da li je problem moguće rešiti u ambulanti ili je potrebno drugačije lečenje. Pre procedure objašnjava tok intervencije i očekivano zarastanje.',
    '/images/doctors/milos-kovacevic.png'
FROM specialties s
WHERE s.name = 'Hirurgija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Miloš' AND d.last_name = 'Kovačević'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Sara',
    'Radovanović',
    s.id,
    'Dr Sara Radovanović radi u okviru ambulante hirurške nege: manje intervencije, previjanje rana i postoperativne kontrole. Prati zarastanje i savetuje pacijente o nezi rane kod kuće. Kontrole usmerava ka bezbednom oporavku, bez nepotrebnog komplikovanja terapije.',
    '/images/doctors/sara-radovanovic.png'
FROM specialties s
WHERE s.name = 'Hirurgija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Sara' AND d.last_name = 'Radovanović'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Vuk',
    'Đukić',
    s.id,
    'Dr Vuk Đukić se bavi opštom kardiologijom, ehokardiografijom i poremećajima srčanog ritma. U dijagnostici povezuje klinički pregled sa ultrazvučnom procenom srca i Holter EKG monitoringom kada je potrebno detaljnije praćenje. Pacijentima jasno objašnjava nalaze i preporuke za dalje kontrole.',
    '/images/doctors/vuk-djukic.png'
FROM specialties s
WHERE s.name = 'Kardiologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Vuk' AND d.last_name = 'Đukić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Mina',
    'Radosavljević',
    s.id,
    'Dr Mina Radosavljević se bavi opštom pulmologijom i funkcionalnom dijagnostikom pluća. Posebnu pažnju posvećuje pacijentima sa otežanim disanjem, astmom i drugim respiratornim tegobama, uz primenu spirometrije kada je potrebna procena plućne funkcije. Pristup prilagođava simptomima i potrebama svakog pacijenta.',
    '/images/doctors/mina-radosavljevic.png'
FROM specialties s
WHERE s.name = 'Pulmologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Mina' AND d.last_name = 'Radosavljević'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Nemanja',
    'Tomić',
    s.id,
    'Dr Nemanja Tomić se bavi endokrinologijom sa posebnim interesovanjem za bolesti štitaste žlezde i ultrazvučnu dijagnostiku. Klinički pregled povezuje sa laboratorijskim nalazima i ultrazvučnom procenom strukture štitaste žlezde. Pacijentima daje jasne smernice za terapiju i dalje praćenje.',
    '/images/doctors/nemanja-tomic.png'
FROM specialties s
WHERE s.name = 'Endokrinologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Nemanja' AND d.last_name = 'Tomić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Sofija',
    'Vuković',
    s.id,
    'Dr Sofija Vuković se bavi opštom i preventivnom ginekologijom, ultrazvučnom dijagnostikom i kolposkopijom. Posebnu pažnju posvećuje redovnim preventivnim pregledima i pravovremenom otkrivanju promena. Preglede vodi pažljivo i diskretno, uz jasno objašnjenje nalaza i narednih koraka.',
    '/images/doctors/sofija-vukovic.png'
FROM specialties s
WHERE s.name = 'Ginekologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Sofija' AND d.last_name = 'Vuković'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Andrea',
    'Kostić',
    s.id,
    'Dr Andrea Kostić se bavi opštom pedijatrijom i preventivnim praćenjem zdravlja dece i adolescenata. Kroz redovne i sistematske preglede prati rast, razvoj i opšte zdravstveno stanje deteta. U radu nastoji da pregled bude prijatan za dete, a roditeljima pruža jasne i praktične preporuke.',
    '/images/doctors/andrea-kostic.png'
FROM specialties s
WHERE s.name = 'Pedijatrija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Andrea' AND d.last_name = 'Kostić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Pavle',
    'Obradović',
    s.id,
    'Dr Pavle Obradović se bavi opštom oftalmologijom, pregledom očnog dna i praćenjem očnog pritiska. Posebnu pažnju posvećuje ranom otkrivanju promena koje mogu uticati na vid i zahtevaju dugoročnije praćenje. Nakon pregleda pacijentima jasno objašnjava nalaz i potrebu za daljim kontrolama.',
    '/images/doctors/pavle-obradovic.png'
FROM specialties s
WHERE s.name = 'Oftalmologija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Pavle' AND d.last_name = 'Obradović'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Teodora',
    'Milić',
    s.id,
    'Dr Teodora Milić se bavi opštom otorinolaringologijom i dijagnostikom poremećaja sluha. U radu kombinuje ORL pregled sa audiometrijom i timpanometrijom kada je potrebna detaljnija procena funkcije uha i sluha. Pacijentima pristupa sistematično i jasno objašnjava rezultate dijagnostike.',
    '/images/doctors/teodora-milic.png'
FROM specialties s
WHERE s.name = 'Otorinolaringologija (ORL)'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Teodora' AND d.last_name = 'Milić'
  );

INSERT INTO doctors (first_name, last_name, specialty_id, biography, image_url)
SELECT
    'Viktor',
    'Stanković',
    s.id,
    'Dr Viktor Stanković se bavi opštom hirurgijom, manjim ambulantnim intervencijama i zbrinjavanjem rana. Pregledom procenjuje potrebu za intervencijom i prati tok oporavka nakon manjih hirurških procedura. Pacijentima pre zahvata objašnjava postupak, a nakon njega daje jasne smernice za negu i kontrolu.',
    '/images/doctors/viktor-stankovic.png'
FROM specialties s
WHERE s.name = 'Hirurgija'
  AND NOT EXISTS (
      SELECT 1 FROM doctors d
      WHERE d.first_name = 'Viktor' AND d.last_name = 'Stanković'
  );

-- =====================================================
-- DOCTOR IMAGE URLS
-- INSERT ... NOT EXISTS does not update existing rows, so image_url is
-- set here by name. Safe to rerun. Doctors without a portrait stay NULL.
-- =====================================================

UPDATE doctors SET image_url = '/images/doctors/vuk-djukic.png'
WHERE first_name = 'Vuk' AND last_name = 'Đukić';

UPDATE doctors SET image_url = '/images/doctors/mina-radosavljevic.png'
WHERE first_name = 'Mina' AND last_name = 'Radosavljević';

UPDATE doctors SET image_url = '/images/doctors/sofija-vukovic.png'
WHERE first_name = 'Sofija' AND last_name = 'Vuković';

UPDATE doctors SET image_url = '/images/doctors/andrea-kostic.png'
WHERE first_name = 'Andrea' AND last_name = 'Kostić';

UPDATE doctors SET image_url = '/images/doctors/pavle-obradovic.png'
WHERE first_name = 'Pavle' AND last_name = 'Obradović';

UPDATE doctors SET image_url = '/images/doctors/teodora-milic.png'
WHERE first_name = 'Teodora' AND last_name = 'Milić';

UPDATE doctors SET image_url = '/images/doctors/viktor-stankovic.png'
WHERE first_name = 'Viktor' AND last_name = 'Stanković';

UPDATE doctors SET image_url = '/images/doctors/nemanja-tomic.png'
WHERE first_name = 'Nemanja' AND last_name = 'Tomić';

-- =====================================================
-- DOCTOR EDUCATION AND PROFESSIONAL EXPERIENCE
-- Columns are added if missing so this seed stays rerunnable on older databases.
-- Existing biography values are not modified.
-- =====================================================

SET @vitamed_col := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'education'
);
SET @vitamed_sql := IF(
    @vitamed_col = 0,
    'ALTER TABLE doctors ADD COLUMN education TEXT NULL AFTER biography',
    'SELECT 1'
);
PREPARE vitamed_stmt FROM @vitamed_sql;
EXECUTE vitamed_stmt;
DEALLOCATE PREPARE vitamed_stmt;

SET @vitamed_col := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'professional_experience'
);
SET @vitamed_sql := IF(
    @vitamed_col = 0,
    'ALTER TABLE doctors ADD COLUMN professional_experience TEXT NULL AFTER education',
    'SELECT 1'
);
PREPARE vitamed_stmt FROM @vitamed_sql;
EXECUTE vitamed_stmt;
DEALLOCATE PREPARE vitamed_stmt;

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz kardiologije.',
    professional_experience = 'Kliničko iskustvo sticao na odeljenju kardiologije univerzitetskog kliničkog centra, sa fokusom na neinvazivnu kardiološku dijagnostiku. U VitaMed-u radi kao specijalista kardiologije.'
WHERE first_name = 'Aleksandar' AND last_name = 'Petrović';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Novom Sadu. Specijalizacija iz kardiologije.',
    professional_experience = 'Radno iskustvo sticala u kardiološkoj ambulanti i jedinici za dijagnostiku poremećaja srčanog ritma. U VitaMed-u je posebno usmerena na Holter EKG monitoring i praćenje aritmija.'
WHERE first_name = 'Jelena' AND last_name = 'Marković';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz kardiologije.',
    professional_experience = 'Pre dolaska u VitaMed radio u kliničkoj kardiologiji i neinvazivnoj dijagnostici, sa iskustvom u ehokardiografiji i praćenju poremećaja srčanog ritma.'
WHERE first_name = 'Vuk' AND last_name = 'Đukić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz pulmologije.',
    professional_experience = 'Višedecenijsko iskustvo stekao u bolničkoj i ambulantnoj pulmologiji, radeći sa pacijentima sa astmom, HOBP-om i drugim hroničnim plućnim bolestima. Svoje dugogodišnje kliničko iskustvo danas primenjuje u VitaMed-u.'
WHERE first_name = 'Nikola' AND last_name = 'Jovanović';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Nišu. Specijalizacija iz pulmologije.',
    professional_experience = 'Pre dolaska u VitaMed radila u pulmološkoj ambulanti i na odeljenju za bolesti pluća, sa posebnim iskustvom u dijagnostici respiratornih infekcija i hroničnih plućnih oboljenja.'
WHERE first_name = 'Milica' AND last_name = 'Stojanović';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz pulmologije.',
    professional_experience = 'Kliničko iskustvo sticala u ambulantnoj pulmologiji i funkcionalnoj dijagnostici pluća. U VitaMed-u se posebno bavi procenom plućne funkcije i spirometrijom.'
WHERE first_name = 'Mina' AND last_name = 'Radosavljević';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz endokrinologije.',
    professional_experience = 'Iskustvo sticala u endokrinološkoj ambulanti i radu sa pacijentima sa bolestima štitaste žlezde. U VitaMed-u povezuje kliničku endokrinologiju sa ultrazvučnom dijagnostikom štitaste žlezde.'
WHERE first_name = 'Ana' AND last_name = 'Ilić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Kragujevcu. Specijalizacija iz endokrinologije.',
    professional_experience = 'Pre VitaMed-a radio u internističkoj i endokrinološkoj ambulanti, gde je stekao iskustvo u praćenju metaboličkih i hormonskih poremećaja.'
WHERE first_name = 'Stefan' AND last_name = 'Nikolić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Novom Sadu. Specijalizacija iz endokrinologije.',
    professional_experience = 'Kliničko iskustvo sticao u oblasti endokrinologije i dijagnostike bolesti štitaste žlezde. U VitaMed-u se bavi pregledima, praćenjem terapije i ultrazvučnom procenom štitaste žlezde.'
WHERE first_name = 'Nemanja' AND last_name = 'Tomić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz ginekologije i akušerstva.',
    professional_experience = 'Tokom višedecenijske karijere radila u bolničkoj i ambulantnoj ginekologiji, sa posebnim iskustvom u preventivnoj dijagnostici i bolestima grlića materice. Nakon penzionisanja iz državne zdravstvene službe, u VitaMed-u je angažovana kao lekar konsultant.'
WHERE first_name = 'Marija' AND last_name = 'Đorđević';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz ginekologije i akušerstva.',
    professional_experience = 'Radno iskustvo sticala u ginekološkoj ambulanti i ultrazvučnoj dijagnostici. U VitaMed-u se bavi opštom ginekologijom, preventivnim pregledima i ultrazvukom male karlice.'
WHERE first_name = 'Katarina' AND last_name = 'Pavlović';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Novom Sadu. Specijalizacija iz ginekologije i akušerstva.',
    professional_experience = 'Pre dolaska u VitaMed radila u ambulantnoj ginekologiji, sa iskustvom u preventivnim pregledima, kolposkopiji i ultrazvučnoj dijagnostici.'
WHERE first_name = 'Sofija' AND last_name = 'Vuković';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz pedijatrije.',
    professional_experience = 'Kliničko iskustvo sticala kroz rad sa decom različitog uzrasta u pedijatrijskoj ambulanti. U VitaMed-u se bavi opštom pedijatrijom, praćenjem razvoja i sistematskim pregledima.'
WHERE first_name = 'Tamara' AND last_name = 'Milošević';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Nišu. Specijalizacija iz pedijatrije.',
    professional_experience = 'Pre dolaska u VitaMed radio u pedijatrijskoj ambulanti, sa posebnim interesovanjem za praćenje rasta i razvoja dece i preventivnu pedijatriju.'
WHERE first_name = 'Luka' AND last_name = 'Savić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz pedijatrije.',
    professional_experience = 'Iskustvo sticala u primarnoj i ambulantnoj pedijatrijskoj zaštiti. U VitaMed-u je usmerena na preventivne, sistematske i opšte pedijatrijske preglede.'
WHERE first_name = 'Andrea' AND last_name = 'Kostić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz oftalmologije.',
    professional_experience = 'Iskustvo sticala u oftalmološkoj ambulanti, sa fokusom na opšte oftalmološke preglede i refraktivnu dijagnostiku. U VitaMed-u se posebno bavi procenom vida i određivanjem dioptrije.'
WHERE first_name = 'Ivana' AND last_name = 'Ristić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Novom Sadu. Specijalizacija iz oftalmologije.',
    professional_experience = 'Pre dolaska u VitaMed radio u oftalmološkoj dijagnostici, sa iskustvom u praćenju očnog pritiska i promena na očnom dnu.'
WHERE first_name = 'Marko' AND last_name = 'Vasić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz oftalmologije.',
    professional_experience = 'Kliničko iskustvo sticao kroz opštu oftalmologiju i dijagnostičke preglede oka. U VitaMed-u se bavi pregledom očnog dna, merenjem očnog pritiska i procenom vida.'
WHERE first_name = 'Pavle' AND last_name = 'Obradović';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz otorinolaringologije.',
    professional_experience = 'Radno iskustvo sticala u ORL ambulanti, gde se bavila dijagnostikom bolesti uha, nosa i grla i procenom poremećaja sluha. U VitaMed-u se posebno bavi opštom ORL dijagnostikom i audiometrijom.'
WHERE first_name = 'Nevena' AND last_name = 'Popović';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz otorinolaringologije.',
    professional_experience = 'Višegodišnje iskustvo stekao u bolničkoj i ambulantnoj otorinolaringologiji, sa posebnim interesovanjem za bolesti uha i dijagnostiku sluha. U VitaMed-u se bavi audiometrijom i timpanometrijom.'
WHERE first_name = 'Filip' AND last_name = 'Lukić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Nišu. Specijalizacija iz otorinolaringologije.',
    professional_experience = 'Kliničko iskustvo sticala u ORL ambulanti i audiološkoj dijagnostici. U VitaMed-u kombinuje opšte ORL preglede sa funkcionalnim ispitivanjem sluha.'
WHERE first_name = 'Teodora' AND last_name = 'Milić';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz opšte hirurgije.',
    professional_experience = 'Hirurško iskustvo sticao kroz bolnički i ambulantni rad, sa fokusom na manje hirurške zahvate i postoperativno praćenje. U VitaMed-u obavlja preglede i manje ambulantne intervencije.'
WHERE first_name = 'Miloš' AND last_name = 'Kovačević';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Novom Sadu. Specijalizacija iz opšte hirurgije.',
    professional_experience = 'Višegodišnje iskustvo stekla u ambulantnoj hirurgiji i postoperativnoj nezi. U VitaMed-u se posebno bavi zbrinjavanjem rana, manjim intervencijama i praćenjem oporavka pacijenata.'
WHERE first_name = 'Sara' AND last_name = 'Radovanović';

UPDATE doctors
SET education = 'Medicinski fakultet Univerziteta u Beogradu. Specijalizacija iz opšte hirurgije.',
    professional_experience = 'Pre dolaska u VitaMed radio u opštoj i ambulantnoj hirurgiji, gde je stekao iskustvo u manjim hirurškim intervencijama, zbrinjavanju rana i postoperativnim kontrolama.'
WHERE first_name = 'Viktor' AND last_name = 'Stanković';

-- =====================================================
-- DOCTOR_SERVICES
-- doctor_id is resolved by first_name + last_name
-- service_id is resolved by service name, only if it belongs to the doctor's specialty
-- INSERT IGNORE skips pairs that already exist (PRIMARY KEY doctor_id, service_id)
-- =====================================================

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Kardiološki pregled',
        'Kontrolni kardiološki pregled',
        'EKG',
        'Ehokardiografija'
   )
WHERE d.first_name = 'Aleksandar' AND d.last_name = 'Petrović';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Kardiološki pregled',
        'Kontrolni kardiološki pregled',
        'EKG',
        'Holter EKG-a'
   )
WHERE d.first_name = 'Jelena' AND d.last_name = 'Marković';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Pulmološki pregled',
        'Kontrolni pulmološki pregled',
        'Spirometrija'
   )
WHERE d.first_name = 'Nikola' AND d.last_name = 'Jovanović';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Pulmološki pregled',
        'Kontrolni pulmološki pregled'
   )
WHERE d.first_name = 'Milica' AND d.last_name = 'Stojanović';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Endokrinološki pregled',
        'Kontrolni endokrinološki pregled',
        'Ultrazvuk štitaste žlezde'
   )
WHERE d.first_name = 'Ana' AND d.last_name = 'Ilić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Endokrinološki pregled',
        'Kontrolni endokrinološki pregled'
   )
WHERE d.first_name = 'Stefan' AND d.last_name = 'Nikolić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Ginekološki pregled',
        'Kontrolni ginekološki pregled',
        'PAPA test',
        'Kolposkopija'
   )
WHERE d.first_name = 'Marija' AND d.last_name = 'Đorđević';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Ginekološki pregled',
        'Kontrolni ginekološki pregled',
        'Ginekološki ultrazvuk',
        'PAPA test'
   )
WHERE d.first_name = 'Katarina' AND d.last_name = 'Pavlović';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Pedijatrijski pregled',
        'Kontrolni pedijatrijski pregled',
        'Sistematski pregled dece'
   )
WHERE d.first_name = 'Tamara' AND d.last_name = 'Milošević';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Pedijatrijski pregled',
        'Kontrolni pedijatrijski pregled',
        'Sistematski pregled dece'
   )
WHERE d.first_name = 'Luka' AND d.last_name = 'Savić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Oftalmološki pregled',
        'Određivanje dioptrije'
   )
WHERE d.first_name = 'Ivana' AND d.last_name = 'Ristić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Oftalmološki pregled',
        'Merenje očnog pritiska',
        'Pregled očnog dna'
   )
WHERE d.first_name = 'Marko' AND d.last_name = 'Vasić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'ORL pregled',
        'Kontrolni ORL pregled',
        'Audiometrija'
   )
WHERE d.first_name = 'Nevena' AND d.last_name = 'Popović';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'ORL pregled',
        'Kontrolni ORL pregled',
        'Audiometrija',
        'Timpanometrija'
   )
WHERE d.first_name = 'Filip' AND d.last_name = 'Lukić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Hirurški pregled',
        'Kontrolni hirurški pregled',
        'Manje hirurške intervencije',
        'Uklanjanje konaca'
   )
WHERE d.first_name = 'Miloš' AND d.last_name = 'Kovačević';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Hirurški pregled',
        'Kontrolni hirurški pregled',
        'Previjanje rane',
        'Uklanjanje konaca',
        'Manje hirurške intervencije'
   )
WHERE d.first_name = 'Sara' AND d.last_name = 'Radovanović';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Kardiološki pregled',
        'Kontrolni kardiološki pregled',
        'EKG',
        'Ehokardiografija',
        'Holter EKG-a'
   )
WHERE d.first_name = 'Vuk' AND d.last_name = 'Đukić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Pulmološki pregled',
        'Kontrolni pulmološki pregled',
        'Spirometrija'
   )
WHERE d.first_name = 'Mina' AND d.last_name = 'Radosavljević';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Endokrinološki pregled',
        'Kontrolni endokrinološki pregled',
        'Ultrazvuk štitaste žlezde'
   )
WHERE d.first_name = 'Nemanja' AND d.last_name = 'Tomić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Ginekološki pregled',
        'Kontrolni ginekološki pregled',
        'Ginekološki ultrazvuk',
        'PAPA test',
        'Kolposkopija'
   )
WHERE d.first_name = 'Sofija' AND d.last_name = 'Vuković';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Pedijatrijski pregled',
        'Kontrolni pedijatrijski pregled',
        'Sistematski pregled dece'
   )
WHERE d.first_name = 'Andrea' AND d.last_name = 'Kostić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Oftalmološki pregled',
        'Određivanje dioptrije',
        'Merenje očnog pritiska',
        'Pregled očnog dna'
   )
WHERE d.first_name = 'Pavle' AND d.last_name = 'Obradović';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'ORL pregled',
        'Kontrolni ORL pregled',
        'Audiometrija',
        'Timpanometrija'
   )
WHERE d.first_name = 'Teodora' AND d.last_name = 'Milić';

INSERT IGNORE INTO doctor_services (doctor_id, service_id)
SELECT d.id, s.id
FROM doctors d
JOIN services s
    ON s.specialty_id = d.specialty_id
   AND s.name IN (
        'Hirurški pregled',
        'Kontrolni hirurški pregled',
        'Previjanje rane',
        'Uklanjanje konaca',
        'Manje hirurške intervencije'
   )
WHERE d.first_name = 'Viktor' AND d.last_name = 'Stanković';

-- =====================================================
-- LOCATIONS
-- INSERT IGNORE skips rows that already exist (unique name)
-- =====================================================

INSERT IGNORE INTO locations (name, address, city, phone, working_hours, latitude, longitude)
VALUES
    (
        'VitaMed Novi Beograd',
        'Antifašističke borbe 15A',
        'Beograd',
        '011 404 2101',
        'Pon–Pet: 07:00–21:00, Sub: 08:00–15:00',
        44.8135600,
        20.4219800
    ),
    (
        'VitaMed Vračar',
        'Kneginje Zorke 27',
        'Beograd',
        '011 404 2102',
        'Pon–Pet: 07:00–21:00, Sub: 08:00–15:00',
        44.8012400,
        20.4768100
    ),
    (
        'VitaMed Voždovac',
        'Vojvode Stepe 218',
        'Beograd',
        '011 404 2103',
        'Pon–Pet: 07:00–21:00, Sub: 08:00–15:00',
        44.7864200,
        20.4773500
    );

-- =====================================================
-- DOCTOR_LOCATIONS
-- doctor_id is resolved by first_name + last_name
-- location_id is resolved by location name
-- INSERT IGNORE skips pairs that already exist (PRIMARY KEY doctor_id, location_id)
-- =====================================================

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Vračar'
    )
WHERE d.first_name = 'Aleksandar' AND d.last_name = 'Petrović';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Jelena' AND d.last_name = 'Marković';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Vračar',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Vuk' AND d.last_name = 'Đukić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Nikola' AND d.last_name = 'Jovanović';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name = 'VitaMed Vračar'
WHERE d.first_name = 'Milica' AND d.last_name = 'Stojanović';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Vračar'
    )
WHERE d.first_name = 'Mina' AND d.last_name = 'Radosavljević';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Vračar'
    )
WHERE d.first_name = 'Ana' AND d.last_name = 'Ilić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name = 'VitaMed Voždovac'
WHERE d.first_name = 'Stefan' AND d.last_name = 'Nikolić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Vračar',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Nemanja' AND d.last_name = 'Tomić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Vračar'
    )
WHERE d.first_name = 'Marija' AND d.last_name = 'Đorđević';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Katarina' AND d.last_name = 'Pavlović';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Vračar',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Sofija' AND d.last_name = 'Vuković';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Tamara' AND d.last_name = 'Milošević';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Vračar',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Luka' AND d.last_name = 'Savić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Vračar'
    )
WHERE d.first_name = 'Andrea' AND d.last_name = 'Kostić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Vračar'
    )
WHERE d.first_name = 'Ivana' AND d.last_name = 'Ristić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Vračar',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Marko' AND d.last_name = 'Vasić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Pavle' AND d.last_name = 'Obradović';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Vračar'
    )
WHERE d.first_name = 'Nevena' AND d.last_name = 'Popović';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Vračar',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Filip' AND d.last_name = 'Lukić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Teodora' AND d.last_name = 'Milić';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Miloš' AND d.last_name = 'Kovačević';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name = 'VitaMed Vračar'
WHERE d.first_name = 'Sara' AND d.last_name = 'Radovanović';

INSERT IGNORE INTO doctor_locations (doctor_id, location_id)
SELECT d.id, l.id
FROM doctors d
JOIN locations l
    ON l.name IN (
        'VitaMed Novi Beograd',
        'VitaMed Vračar',
        'VitaMed Voždovac'
    )
WHERE d.first_name = 'Viktor' AND d.last_name = 'Stanković';

-- =====================================================
-- DOCTOR_SCHEDULES
-- doctor_id / location_id resolved by name
-- location must already exist in doctor_locations
-- INSERT IGNORE skips existing (doctor_id, day_of_week) pairs
-- day_of_week: 1=Monday ... 6=Saturday (no Sunday in this seed)
-- =====================================================

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Aleksandar' AND d.last_name = 'Petrović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Aleksandar' AND d.last_name = 'Petrović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Aleksandar' AND d.last_name = 'Petrović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Aleksandar' AND d.last_name = 'Petrović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Jelena' AND d.last_name = 'Marković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Jelena' AND d.last_name = 'Marković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Jelena' AND d.last_name = 'Marković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Vuk' AND d.last_name = 'Đukić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Vuk' AND d.last_name = 'Đukić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Vuk' AND d.last_name = 'Đukić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 6, '09:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Vuk' AND d.last_name = 'Đukić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nikola' AND d.last_name = 'Jovanović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '09:00:00', '15:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nikola' AND d.last_name = 'Jovanović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nikola' AND d.last_name = 'Jovanović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Milica' AND d.last_name = 'Stojanović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Milica' AND d.last_name = 'Stojanović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Mina' AND d.last_name = 'Radosavljević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '09:00:00', '15:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Mina' AND d.last_name = 'Radosavljević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Mina' AND d.last_name = 'Radosavljević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 6, '08:00:00', '13:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Mina' AND d.last_name = 'Radosavljević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Ana' AND d.last_name = 'Ilić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Ana' AND d.last_name = 'Ilić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 6, '09:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Ana' AND d.last_name = 'Ilić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Stefan' AND d.last_name = 'Nikolić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Stefan' AND d.last_name = 'Nikolić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nemanja' AND d.last_name = 'Tomić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '08:00:00', '13:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nemanja' AND d.last_name = 'Tomić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nemanja' AND d.last_name = 'Tomić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '09:00:00', '15:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Marija' AND d.last_name = 'Đorđević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Marija' AND d.last_name = 'Đorđević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Marija' AND d.last_name = 'Đorđević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '15:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Marija' AND d.last_name = 'Đorđević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Katarina' AND d.last_name = 'Pavlović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Katarina' AND d.last_name = 'Pavlović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Katarina' AND d.last_name = 'Pavlović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Sofija' AND d.last_name = 'Vuković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '09:00:00', '15:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Sofija' AND d.last_name = 'Vuković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Sofija' AND d.last_name = 'Vuković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 6, '08:00:00', '13:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Sofija' AND d.last_name = 'Vuković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Tamara' AND d.last_name = 'Milošević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Tamara' AND d.last_name = 'Milošević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Tamara' AND d.last_name = 'Milošević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Luka' AND d.last_name = 'Savić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Luka' AND d.last_name = 'Savić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Andrea' AND d.last_name = 'Kostić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Andrea' AND d.last_name = 'Kostić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Andrea' AND d.last_name = 'Kostić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Andrea' AND d.last_name = 'Kostić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Ivana' AND d.last_name = 'Ristić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Ivana' AND d.last_name = 'Ristić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Marko' AND d.last_name = 'Vasić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Marko' AND d.last_name = 'Vasić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Marko' AND d.last_name = 'Vasić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Pavle' AND d.last_name = 'Obradović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Pavle' AND d.last_name = 'Obradović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '15:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Pavle' AND d.last_name = 'Obradović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '09:00:00', '15:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Pavle' AND d.last_name = 'Obradović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nevena' AND d.last_name = 'Popović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nevena' AND d.last_name = 'Popović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Nevena' AND d.last_name = 'Popović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Filip' AND d.last_name = 'Lukić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Filip' AND d.last_name = 'Lukić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Filip' AND d.last_name = 'Lukić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Filip' AND d.last_name = 'Lukić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Teodora' AND d.last_name = 'Milić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Teodora' AND d.last_name = 'Milić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 6, '08:00:00', '13:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Teodora' AND d.last_name = 'Milić';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Miloš' AND d.last_name = 'Kovačević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Miloš' AND d.last_name = 'Kovačević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '08:00:00', '13:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Miloš' AND d.last_name = 'Kovačević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Miloš' AND d.last_name = 'Kovačević';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Sara' AND d.last_name = 'Radovanović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 3, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Sara' AND d.last_name = 'Radovanović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 5, '08:00:00', '13:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Sara' AND d.last_name = 'Radovanović';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 1, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Novi Beograd'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Viktor' AND d.last_name = 'Stanković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 2, '08:00:00', '14:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Voždovac'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Viktor' AND d.last_name = 'Stanković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 4, '14:00:00', '20:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Viktor' AND d.last_name = 'Stanković';

INSERT IGNORE INTO doctor_schedules (doctor_id, location_id, day_of_week, start_time, end_time)
SELECT d.id, l.id, 6, '08:00:00', '13:00:00'
FROM doctors d
JOIN locations l ON l.name = 'VitaMed Vračar'
JOIN doctor_locations dl ON dl.doctor_id = d.id AND dl.location_id = l.id
WHERE d.first_name = 'Viktor' AND d.last_name = 'Stanković';

SET SQL_SAFE_UPDATES = 1;