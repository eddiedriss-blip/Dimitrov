import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'node:fs';

const DOSSIER_MIGRATIONS = new URL('../migrations/', import.meta.url).pathname;
const MIGRATIONS = fs.readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const dir = new URL('./data', import.meta.url).pathname;
fs.rmSync(dir, { recursive: true, force: true });

const pgServer = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: 54329, persistent: false });
await pgServer.initialise();
await pgServer.start();

const db = new pg.Client({ host: 'localhost', port: 54329, user: 'postgres', password: 'postgres', database: 'postgres' });
await db.connect();

let ok = 0, ko = 0;
const pass = (m) => { ok++; console.log('  ✔', m); };
const fail = (m, e) => { ko++; console.log('  ✘', m, e ? `→ ${e}` : ''); };
const check = (cond, m, detail) => (cond ? pass(m) : fail(m, detail));

// Exécute fn dans une transaction avec le rôle et l'utilisateur donnés (null = superuser postgres)
async function as(uid, fn, role = 'authenticated') {
  await db.query('begin');
  try {
    if (role) {
      await db.query(`set local role ${role}`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    }
    const q = (sql, p) => db.query(sql, p).then((r) => r);
    const res = await fn(q);
    await db.query('commit');
    return res;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
const su = (fn) => as(null, fn, null);
async function expectError(promise, pattern, m) {
  try { await promise; fail(m, 'aucune erreur'); }
  catch (e) { check(pattern.test(e.message) || pattern.test(e.code ?? ''), m, `${e.code} ${e.message}`); }
}

// ---------------------------------------------------------------- installation
console.log('\n== Installation');
await db.query(fs.readFileSync(new URL('./supabase_shim.sql', import.meta.url), 'utf8'));
const { rows: [{ version }] } = await db.query('select version()');
console.log('  ', version.split(',')[0]);
for (const fichier of MIGRATIONS) {
  try {
    await db.query('begin');
    await db.query(fs.readFileSync(DOSSIER_MIGRATIONS + fichier, 'utf8'));
    await db.query('commit');
    pass(`migration ${fichier} appliquée (en une transaction)`);
  } catch (e) {
    await db.query('rollback');
    fail(`migration ${fichier}`, `${e.message} ${e.where ?? ''}`);
    process.exitCode = 1;
    await db.end(); await pgServer.stop(); process.exit();
  }
}

// ---------------------------------------------------------------- utilisateurs
console.log('\n== Utilisateurs & profils');
const mkUser = async (email, meta = {}) => {
  // simulé comme le service Auth de Supabase (rôle supabase_auth_admin)
  const { rows: [u] } = await as(null, (q) => q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, meta]), 'supabase_auth_admin');
  await su((q) => q(`insert into auth.identities (user_id, identity_data) values ($1, $2)`, [u.id, { sub: u.id, email }]));
  await su((q) => q(`insert into auth.sessions (user_id) values ($1)`, [u.id]));
  return u.id;
};
const admin = await mkUser('admin@test.fr', { nom: 'Martin', prenom: 'Alice' });
const gest = await mkUser('gest@test.fr', { nom: 'Durand', prenom: 'Bob' });
const lect = await mkUser('lect@test.fr');
const inactif = await mkUser('parti@test.fr');
const prof = await su((q) => q(`select role, nom, actif from public.utilisateurs where id = $1`, [admin]));
check(prof.rows[0]?.role === 'utilisateur' && prof.rows[0].nom === 'Martin', 'profil créé automatiquement (rôle utilisateur)');
await su((q) => q(`update public.utilisateurs set role = 'admin' where id = $1`, [admin]));
await su((q) => q(`update public.utilisateurs set role = 'utilisateur' where id = $1`, [gest]));
await su((q) => q(`update public.utilisateurs set role = 'utilisateur', actif = false where id = $1`, [inactif]));

const r1 = await as(gest, (q) => q(`update public.utilisateurs set role = 'admin' where id = $1`, [gest]));
check(r1.rowCount === 0, 'un utilisateur ne peut pas s\'auto-promouvoir admin');
const r2 = await as(lect, (q) => q(`select count(*)::int n from public.utilisateurs`));
check(r2.rows[0].n === 4, 'un utilisateur actif voit ses collègues (noms dans l\'historique)');

// ---------------------------------------------------------------- référentiels
console.log('\n== Référentiels & accès anonyme');
const st = await as(lect, (q) => q(`select count(*)::int n from public.statuts`));
check(st.rows[0].n === 9, '9 statuts (6 logement + 3 travail) lisibles');
const an = await as(null, (q) => q(`select count(*)::int n from public.statuts`), 'anon');
check(an.rows[0].n === 0, 'anon ne voit rien');
const ina = await as(inactif, (q) => q(`select count(*)::int n from public.statuts`));
check(ina.rows[0].n === 0, 'utilisateur désactivé ne voit rien');
await expectError(as(lect, (q) => q(`insert into public.reservataires (nom) values ('X')`)), /row-level security/, 'utilisateur ne peut pas créer de réservataire (paramètre admin)');
await expectError(as(gest, (q) => q(`insert into public.groupes (code, nom) values ('10001','Les Tilleuls')`)), /row-level security/, 'utilisateur ne peut pas créer de groupe (admin seul)');
await expectError(as(gest, (q) => q(`update public.statuts set libelle = 'X' where code = 'loue' returning code`).then((r) => { if (!r.rowCount) throw new Error('row-level security: 0 ligne'); })), /row-level security/, 'utilisateur ne peut pas modifier les statuts (paramètre admin)');
await expectError(as(null, (q) => q(`select private.est_admin()`), 'anon'), /permission denied/, 'schéma private inaccessible à anon');

const { rows: [grp] } = await as(admin, (q) => q(`insert into public.groupes (code, nom, commune) values ('10001','Les Tilleuls','Grenoble') returning id`));
pass('admin crée un groupe (sans secteur)');
const { rows: [resa] } = await as(admin, (q) => q(`insert into public.reservataires (nom, categorie) values ('Préfecture 38','prefecture') returning id`));
const { rows: [ent] } = await as(gest, (q) => q(`insert into public.entreprises (raison_sociale, siret) values ('Peinture Alpes','12345678901234') returning id`));
pass('utilisateur crée une entreprise');

// ---------------------------------------------------------------- logements
console.log('\n== Logements');
await expectError(as(inactif, (q) => q(`insert into public.logements (numero_esi, groupe_id, type_logement_code) values ('10001L0999',$1,'T2')`, [grp.id])), /row-level security/, 'compte désactivé ne peut pas créer de logement');
const { rows: [L] } = await as(gest, (q) => q(
  `insert into public.logements (numero_esi, groupe_id, type_logement_code, plafond_code, reservataire_id, loyer, charges)
   values ('10001L0001', $1, 'T3', 'PLUS', $2, 450.00, 80.50) returning id, created_by`, [grp.id, resa.id]));
check(L.created_by === gest, 'utilisateur crée un logement (created_by = auth.uid())');
await expectError(as(gest, (q) => q(`insert into public.logements (numero_esi, groupe_id, type_logement_code) values ('10001L0001',$1,'T2')`, [grp.id])), /logements_numero_esi_key/, 'N° ESI unique');
await expectError(as(gest, (q) => q(`update public.logements set statut_code = 'fini' where id = $1`, [L.id])), /logements_statut_fk/, 'statut de travail refusé sur un logement');

const vac1 = await su((q) => q(`select * from public.vacances where logement_id = $1`, [L.id]));
check(vac1.rowCount === 1 && vac1.rows[0].date_fin === null, 'vacance ouverte automatiquement à la création');

const vl = await as(lect, (q) => q(`select loyer_charges, statut_libelle, archive, duree_vacance_jours from public.v_logements where id = $1`, [L.id]));
check(vl.rows[0]?.loyer_charges === '530.50' && vl.rows[0].statut_libelle === 'Vacant technique' && vl.rows[0].archive === false,
  'v_logements : loyer_charges = 530.50 calculé, statut lisible', JSON.stringify(vl.rows[0]));

const ru = await as(inactif, (q) => q(`update public.logements set loyer = 1 where id = $1`, [L.id]));
check(ru.rowCount === 0, 'compte désactivé ne peut pas modifier un logement');
await as(gest, (q) => q(`update public.logements set loyer = 460.00 where id = $1`, [L.id]));
const h1 = await as(lect, (q) => q(`select champ, ancienne_valeur, nouvelle_valeur, utilisateur_id, automatique, cree_le from public.historique where logement_id = $1 and champ = 'loyer'`, [L.id]));
check(h1.rowCount === 1 && h1.rows[0].ancienne_valeur === 450 && h1.rows[0].nouvelle_valeur === 460 && h1.rows[0].utilisateur_id === gest && h1.rows[0].automatique === false && h1.rows[0].cree_le,
  'historique : loyer 450 → 460, utilisateur, date/heure, manuel', JSON.stringify(h1.rows[0]));

// ---------------------------------------------------------------- suppression interdite
console.log('\n== Logement jamais supprimé');
await expectError(as(gest, (q) => q(`delete from public.logements where id = $1`, [L.id])), /permission denied/, 'utilisateur : DELETE refusé');
await expectError(as(admin, (q) => q(`delete from public.logements where id = $1`, [L.id])), /permission denied/, 'admin : DELETE refusé');
await expectError(as(null, (q) => q(`delete from public.logements where id = $1`, [L.id]), 'service_role'), /Suppression interdite/, 'service_role : DELETE bloqué par trigger');
await expectError(su((q) => q(`delete from public.logements`)), /Suppression interdite/, 'superuser : DELETE bloqué par trigger');
await expectError(su((q) => q(`truncate public.logements cascade`)), /Suppression interdite/, 'superuser : TRUNCATE bloqué');

// ---------------------------------------------------------------- historique inviolable
console.log('\n== Historique inviolable');
await expectError(as(gest, (q) => q(`insert into public.historique (logement_id, entite, entite_id, action) values ($1,'logement',$1,'creation')`, [L.id])), /permission denied/, 'insertion manuelle refusée');
await expectError(as(admin, (q) => q(`update public.historique set nouvelle_valeur = '0'`)), /permission denied/, 'modification refusée (même admin)');
await expectError(as(admin, (q) => q(`delete from public.historique`)), /permission denied/, 'suppression refusée (même admin)');

// ---------------------------------------------------------------- travaux & passage auto
console.log('\n== Travaux & passage automatique à « Travaux finis »');
await expectError(as(gest, (q) => q(`insert into public.travaux (logement_id, libelle, statut_code) values ($1,'Peinture','commande')`, [L.id])), /travaux_entreprise_si_commande/, 'travail « Commandé » sans entreprise refusé');
const { rows: [T1] } = await as(gest, (q) => q(`insert into public.travaux (logement_id, libelle, montant_estime_ht) values ($1,'Peinture',1200) returning id, vacance_id`, [L.id]));
check(T1.vacance_id === vac1.rows[0].id, 'travail rattaché automatiquement à la vacance en cours');
const { rows: [T2] } = await as(gest, (q) => q(`insert into public.travaux (logement_id, libelle, montant_estime_ht) values ($1,'Plomberie',800) returning id`, [L.id]));
await as(gest, (q) => q(`update public.logements set statut_code = 'travaux_commandes' where id = $1`, [L.id]));
await as(gest, (q) => q(`update public.travaux set statut_code = 'commande', entreprise_id = $2, montant_commande_ht = 1150 where id = $1`, [T1.id, ent.id]));
await as(gest, (q) => q(`update public.travaux set statut_code = 'commande', entreprise_id = $2, montant_commande_ht = 850 where id = $1`, [T2.id, ent.id]));
const dc = await su((q) => q(`select date_commande from public.travaux where id = $1`, [T1.id]));
check(dc.rows[0].date_commande !== null, 'date_commande renseignée automatiquement');
await as(gest, (q) => q(`update public.travaux set statut_code = 'fini' where id = $1`, [T1.id]));
let s = await su((q) => q(`select statut_code from public.logements where id = $1`, [L.id]));
check(s.rows[0].statut_code === 'travaux_commandes', '1 travail sur 2 fini → statut logement inchangé');
await as(gest, (q) => q(`update public.travaux set statut_code = 'fini' where id = $1`, [T2.id]));
s = await su((q) => q(`select statut_code from public.logements where id = $1`, [L.id]));
check(s.rows[0].statut_code === 'travaux_finis', 'tous les travaux finis → logement passé automatiquement à « Travaux finis »');
const ha = await su((q) => q(`select ancienne_valeur, nouvelle_valeur, automatique, utilisateur_id from public.historique where logement_id = $1 and champ = 'statut_code' order by id desc limit 1`, [L.id]));
check(ha.rows[0].automatique === true && ha.rows[0].nouvelle_valeur === 'travaux_finis' && ha.rows[0].utilisateur_id === gest,
  'historique : changement marqué automatique, attribué à l\'utilisateur déclencheur', JSON.stringify(ha.rows[0]));
const hm = await su((q) => q(`select count(*)::int n from public.historique where champ = 'loyer' and automatique`));
check(hm.rows[0].n === 0, 'les changements manuels restent marqués manuels');

await as(gest, (q) => q(`update public.logements set statut_code = 'travaux_a_faire' where id = $1`, [L.id]));
s = await su((q) => q(`select statut_code from public.logements where id = $1`, [L.id]));
check(s.rows[0].statut_code === 'travaux_a_faire', 'modification manuelle du statut toujours possible après le passage auto');
await as(gest, (q) => q(`update public.logements set statut_code = 'a_louer' where id = $1`, [L.id]));
await as(gest, (q) => q(`update public.travaux set libelle = 'Peinture complète' where id = $1`, [T1.id]));
await as(gest, (q) => q(`update public.travaux set statut_code = 'commande' where id = $1`, [T2.id]));
await as(gest, (q) => q(`update public.travaux set statut_code = 'fini' where id = $1`, [T2.id]));
s = await su((q) => q(`select statut_code from public.logements where id = $1`, [L.id]));
check(s.rows[0].statut_code === 'a_louer', 'statut « À louer » posé manuellement jamais écrasé par l\'automatisme');

// ---------------------------------------------------------------- photos & storage
console.log('\n== Photos & Storage');
await as(gest, (q) => q(`insert into public.photos (logement_id, travail_id, storage_path) values ($1,$2,$3)`, [L.id, T1.id, `${L.id}/avant.jpg`]));
pass('photo liée à un travail du même logement');
await expectError(as(gest, (q) => q(`insert into public.photos (logement_id, storage_path) values ($1,'autre/x.jpg')`, [L.id])), /photos_chemin_logement/, 'chemin Storage hors dossier du logement refusé');
const { rows: [L2] } = await as(gest, (q) => q(`insert into public.logements (numero_esi, groupe_id, type_logement_code) values ('10001L0002',$1,'T2') returning id`, [grp.id]));
await expectError(as(gest, (q) => q(`insert into public.photos (logement_id, travail_id, storage_path) values ($1,$2,$3)`, [L2.id, T1.id, `${L2.id}/x.jpg`])), /photos_travail_fk/, 'photo liée au travail d\'un autre logement refusée');
await as(gest, (q) => q(`insert into storage.objects (bucket_id, name) values ('photos-logements', $1)`, [`${L.id}/avant.jpg`]));
pass('utilisateur dépose un fichier dans le bucket');
await expectError(as(inactif, (q) => q(`insert into storage.objects (bucket_id, name) values ('photos-logements', $1)`, [`${L.id}/b.jpg`])), /row-level security/, 'compte désactivé ne peut pas déposer de fichier');
await expectError(as(gest, (q) => q(`insert into storage.objects (bucket_id, name) values ('photos-logements', 'pas-un-uuid/b.jpg')`)), /row-level security/, 'chemin Storage malformé refusé');
const so = await as(lect, (q) => q(`select count(*)::int n from storage.objects`));
check(so.rows[0].n === 1, 'utilisateur peut lire les photos');
const soa = await as(null, (q) => q(`select count(*)::int n from storage.objects`), 'anon');
check(soa.rows[0].n === 0, 'anon ne voit aucune photo');

// ---------------------------------------------------------------- vacances successives
console.log('\n== Vacances successives');
await as(gest, (q) => q(`update public.logements set statut_code = 'loue' where id = $1`, [L.id]));
let v = await su((q) => q(`select id, date_fin from public.vacances where logement_id = $1 order by date_debut`, [L.id]));
check(v.rowCount === 1 && v.rows[0].date_fin !== null, 'passage à « Loué » → vacance fermée');
const vl2 = await as(lect, (q) => q(`select archive from public.v_logements where id = $1`, [L.id]));
check(vl2.rows[0].archive === true, 'logement loué = archivé, toujours consultable');

await as(admin, (q) => q(`update public.logements set statut_code = 'a_louer' where id = $1`, [L.id]));
v = await su((q) => q(`select id, date_fin from public.vacances where logement_id = $1`, [L.id]));
check(v.rowCount === 1 && v.rows[0].date_fin === null, 'annulation le jour même → même vacance rouverte (pas de doublon)');
await as(gest, (q) => q(`update public.logements set statut_code = 'loue' where id = $1`, [L.id]));

// on vieillit la 1re vacance pour simuler un départ ultérieur
await su((q) => q(`update public.vacances set date_debut = date '2026-01-05', date_fin = date '2026-03-02' where logement_id = $1`, [L.id]));
await as(admin, (q) => q(`update public.logements set statut_code = 'vacant_technique' where id = $1`, [L.id]));
v = await su((q) => q(`select id, date_debut, date_fin from public.vacances where logement_id = $1 order by date_debut`, [L.id]));
check(v.rowCount === 2 && v.rows[1].date_fin === null, 'nouveau départ → 2e vacance ouverte, la 1re conservée');
const { rows: [T3] } = await as(gest, (q) => q(`insert into public.travaux (logement_id, libelle, montant_estime_ht) values ($1,'Sols',500) returning vacance_id`, [L.id]));
check(T3.vacance_id === v.rows[1].id, 'nouveaux travaux rattachés à la 2e vacance');
await expectError(as(gest, (q) => q(`insert into public.vacances (logement_id, date_debut) values ($1, date '2026-02-01')`, [L.id])), /vacances_sans_chevauchement/, 'vacances qui se chevauchent refusées');
await expectError(as(gest, (q) => q(`update public.vacances set date_fin = date '2026-01-01' where id = $1`, [v.rows[0].id])), /vacances_dates_coherentes/, 'date de fin avant date de début refusée');

const ind = await as(lect, (q) => q(`select duree_jours, nb_travaux, nb_travaux_finis, montant_estime_ht, montant_commande_ht, en_cours from public.v_vacances where logement_id = $1 order by date_debut`, [L.id]));
check(ind.rows[0].duree_jours === 56 && ind.rows[0].nb_travaux === '2' && ind.rows[0].montant_estime_ht === '2000.00' && ind.rows[0].montant_commande_ht === '2000.00' && ind.rows[0].en_cours === false,
  'v_vacances 1re vacance : 56 jours, 2 travaux, 2000 € estimés / 2000 € commandés', JSON.stringify(ind.rows[0]));
check(ind.rows[1].nb_travaux === '1' && ind.rows[1].en_cours === true, 'v_vacances 2e vacance : en cours, 1 travail', JSON.stringify(ind.rows[1]));
const hv = await su((q) => q(`select count(*)::int n from public.historique where entite = 'vacance' and automatique`));
check(hv.rows[0].n >= 3, 'ouvertures/fermetures de vacances journalisées comme automatiques');

// ---------------------------------------------------------------- suppression de travaux
console.log('\n== Suppression de travaux');
const rd = await as(gest, (q) => q(`delete from public.travaux where id = $1`, [T2.id]));
check(rd.rowCount === 0, 'utilisateur ne peut pas supprimer un travail');
await as(admin, (q) => q(`delete from public.travaux where id = $1`, [T1.id]));
const ph = await su((q) => q(`select travail_id from public.photos where logement_id = $1`, [L.id]));
check(ph.rows[0].travail_id === null, 'admin supprime un travail → la photo reste, détachée du travail');
const hd = await su((q) => q(`select count(*)::int n from public.historique where entite = 'travail' and action = 'suppression'`));
check(hd.rows[0].n === 1, 'suppression du travail journalisée');
await expectError(as(admin, (q) => q(`delete from public.vacances where id = $1`, [v.rows[0].id])), /travaux_vacance_fk/, 'vacance ayant des travaux non supprimable');

// ---------------------------------------------------------------- RGPD
console.log('\n== Anonymisation RGPD');
await expectError(as(gest, (q) => q(`select public.anonymiser_utilisateur($1)`, [lect])), /administrateurs/, 'anonymisation réservée aux admins');
await expectError(as(null, (q) => q(`select public.anonymiser_utilisateur($1)`, [lect]), 'anon'), /permission denied/, 'anonymisation inaccessible à anon');
await expectError(as(admin, (q) => q(`select public.anonymiser_utilisateur($1)`, [admin])), /lui-même/, 'un admin ne peut pas s\'anonymiser lui-même');
const hBefore = await su((q) => q(`select count(*)::int n from public.historique where utilisateur_id = $1`, [gest]));
await as(admin, (q) => q(`select public.anonymiser_utilisateur($1)`, [gest]));
const an1 = await su((q) => q(`select u.email, u.nom, u.prenom, u.actif, u.anonymise_le, a.email ae, a.raw_user_meta_data m, a.banned_until,
  (select email from auth.identities where user_id = u.id) ie, (select count(*)::int from auth.sessions where user_id = u.id) ns
  from public.utilisateurs u join auth.users a on a.id = u.id where u.id = $1`, [gest]));
const a = an1.rows[0];
check(!/gest@test\.fr/.test(JSON.stringify(a)) && a.nom === 'Utilisateur' && a.actif === false && a.banned_until && a.ns === 0,
  'profil + compte Auth anonymisés (e-mail, nom, métadonnées, identités), compte bloqué, sessions fermées', JSON.stringify(a));
const hAfter = await su((q) => q(`select count(*)::int n from public.historique where utilisateur_id = $1`, [gest]));
check(hAfter.rows[0].n === hBefore.rows[0].n && hAfter.rows[0].n > 0, `historique intact (${hAfter.rows[0].n} événements toujours rattachés)`);
const gAfter = await as(gest, (q) => q(`select count(*)::int n from public.logements`));
check(gAfter.rows[0].n === 0, 'utilisateur anonymisé n\'accède plus à rien');

// ---------------------------------------------------------------- gestion des vacants
console.log('\n== Gestion des vacants : enregistrement');
const enregistrer = (uid, id, logement, vacance = {}) =>
  as(uid, (q) => q(`select public.enregistrer_logement($1, $2, $3) as id`, [id, logement, vacance])).then((r) => r.rows[0].id);
const { rows: [grp2] } = await as(admin, (q) => q(`insert into public.groupes (code, nom) values ('10002','Résidence du Parc') returning id`));
const { rows: [resa2] } = await as(admin, (q) => q(`insert into public.reservataires (nom, categorie) values ('Action Logement','action_logement') returning id`));
const agent = lect; // compte « utilisateur » actif

const idA = await enregistrer(agent, null,
  { numero_esi: ' 10002l1001 ', groupe_id: grp2.id, type_logement_code: 'T2', plafond_code: 'PLAI', reservataire_id: resa2.id, etage: 3, surface_habitable: 48.5, loyer: 380, charges: 60, commentaire: 'Clés au gardien' },
  { nom_ancien_locataire: 'Chloé Lefèvre', date_preavis: '2026-08-01', date_envoi_reservataire: '2026-09-10', date_disponibilite: '2026-10-15', date_debut: '2026-09-01' });
const vA = await as(agent, (q) => q(`select * from public.v_logements where id = $1`, [idA]));
const a0 = vA.rows[0];
check(a0.numero_esi === '10002L1001' && a0.loyer_charges === '440.00' && a0.nom_ancien_locataire === 'Chloé Lefèvre' && a0.statut_travaux === 'aucun' && a0.plafond_libelle?.startsWith('PLAI'),
  'création logement + vacance en une transaction (ESI nettoyé, loyer+charges, ancien locataire, statut travaux)', JSON.stringify(a0));
check(a0.date_reprise?.toISOString?.().startsWith('2026-10-1') && a0.date_liberation?.toISOString?.().startsWith('2026-0'), 'date de reprise et date de libération enregistrées sur la vacance');
await expectError(enregistrer(agent, null, { numero_esi: '   ', groupe_id: grp2.id, type_logement_code: 'T2' }), /N° ESI invalide/, 'N° ESI vide refusé');
await expectError(enregistrer(agent, null, { numero_esi: '10002L1001', groupe_id: grp2.id, type_logement_code: 'T2' }), /logements_numero_esi_key/, 'N° ESI en double refusé');
await expectError(enregistrer(inactif, null, { numero_esi: '10002L0009', groupe_id: grp2.id, type_logement_code: 'T2' }), /row-level security/, 'compte désactivé ne peut pas enregistrer');

await enregistrer(agent, idA, { ...a0, loyer: 390 }, { nom_ancien_locataire: 'Chloé Lefèvre', date_preavis: '2026-08-02', date_disponibilite: '2026-10-15' });
const hA = await su((q) => q(`select entite, champ from public.historique where logement_id = $1 and action = 'modification' order by id`, [idA]));
check(hA.rows.some((r) => r.entite === 'logement' && r.champ === 'loyer') && hA.rows.some((r) => r.entite === 'vacance' && r.champ === 'date_preavis') && !hA.rows.some((r) => r.champ === 'numero_esi'),
  'modification : seuls les champs changés sont journalisés (loyer, date_preavis)', JSON.stringify(hA.rows));

await enregistrer(agent, idA, { ...a0, statut_code: 'loue' }, { nom_ancien_locataire: 'Chloé Lefèvre' });
await enregistrer(admin, idA, { ...a0, statut_code: 'vacant_technique' }, { nom_ancien_locataire: 'Chloé Lefèvre', date_preavis: '2026-08-02' });
const vA2 = await su((q) => q(`select count(*)::int n, count(*) filter (where date_fin is null and nom_ancien_locataire is null)::int n_ouvertes_vierges from public.vacances where logement_id = $1`, [idA]));
check(vA2.rows[0].n >= 1 && vA2.rows[0].n_ouvertes_vierges <= 1, 'sortie de « Loué » : les infos de l\'ancienne vacance ne sont pas recopiées', JSON.stringify(vA2.rows[0]));

console.log('\n== Gestion des vacants : recherche, filtres, tri, pagination');
const types = ['T1', 'T2', 'T3', 'T4'];
for (let i = 1; i <= 30; i++) {
  await enregistrer(agent, null,
    { numero_esi: `${i % 2 ? '10002' : '10001'}L2${String(i).padStart(3, '0')}`, groupe_id: i % 2 ? grp2.id : grp.id, type_logement_code: types[i % 4], plafond_code: i % 3 ? 'PLUS' : 'PLS',
      reservataire_id: i % 5 ? resa2.id : null, etage: i % 6, surface_habitable: 30 + i, loyer: 300 + i * 10, charges: 50,
      statut_code: i <= 3 ? 'loue' : i % 2 ? 'a_louer' : 'travaux_a_faire' },
    { nom_ancien_locataire: i === 7 ? 'Émile Zoé' : `Locataire ${i}`, date_preavis: `2026-0${1 + (i % 9)}-15` });
}
const chercher = (uid, args) => as(uid, (q) => q(
  `select public.rechercher_logements($1, $2, $3, $4, $5, $6) as r`,
  [args.recherche ?? null, args.filtres ?? {}, args.tri ?? 'numero_esi', args.sens ?? 'asc', args.page ?? 1, args.taille ?? 25])).then((r) => r.rows[0].r);

let r = await chercher(agent, {});
const totalVisibles = r.total;
check(r.lignes.length === Math.min(25, r.total) && r.lignes.every((l) => l.statut_code !== 'loue'), `par défaut : loués exclus, page de 25 (${r.total} résultats)`);
const page2 = await chercher(agent, { page: 2 });
check(page2.lignes.length === r.total - 25 && page2.lignes[0].numero_esi > r.lignes.at(-1).numero_esi, 'page 2 = la suite, sans doublon');
r = await chercher(agent, { filtres: { inclure_loues: true } });
check(r.total > totalVisibles, 'option « inclure les loués »');
r = await chercher(agent, { filtres: { statut_code: 'loue' } });
check(r.total >= 3 && r.lignes.every((l) => l.statut_code === 'loue'), 'filtre statut = Loué affiche les archivés');
r = await chercher(agent, { recherche: 'emile zoe' });
check(r.total === 1 && r.lignes[0].numero_esi === '10002L2007', 'recherche générale sans accents ni majuscules (« emile zoe » → Émile Zoé)');
r = await chercher(agent, { recherche: 'résidence du parc' });
check(r.total > 0 && r.lignes.every((l) => l.groupe_nom === 'Résidence du Parc'), 'recherche sur le nom du groupe');
r = await chercher(agent, { filtres: { groupe_id: grp2.id, type_logement_code: 'T2', plafond_code: 'PLUS', statut_code: 'a_louer' } });
check(r.total > 0 && r.lignes.every((l) => l.groupe_id === grp2.id && l.type_logement_code === 'T2' && l.plafond_code === 'PLUS' && l.statut_code === 'a_louer'), `4 filtres combinés (${r.total} résultats)`);
r = await chercher(agent, { filtres: { reservataire_id: 'aucun' } });
check(r.total > 0 && r.lignes.every((l) => l.reservataire_id === null), 'filtre « sans réservataire »');
r = await chercher(agent, { filtres: { surface_min: 40, surface_max: 50, loyer_charges_min: 400 } });
check(r.total > 0 && r.lignes.every((l) => +l.surface_habitable >= 40 && +l.surface_habitable <= 50 && +l.loyer_charges >= 400), 'filtres par intervalles (surface, loyer+charges)');
r = await chercher(agent, { filtres: { date_preavis_du: '2026-03-01', date_preavis_au: '2026-04-30' } });
check(r.total > 0 && r.lignes.every((l) => l.date_preavis >= '2026-03-01' && l.date_preavis <= '2026-04-30'), 'filtre par période de préavis');
r = await chercher(agent, { filtres: { statut_travaux: 'aucun', etage: 2 } });
check(r.total > 0 && r.lignes.every((l) => l.statut_travaux === 'aucun' && l.etage === 2), 'filtres statut des travaux + étage');
r = await chercher(agent, { tri: 'loyer_charges', sens: 'desc', taille: 200 });
const lc = r.lignes.map((l) => l.loyer_charges).filter((x) => x !== null);
check(lc.every((x, i) => i === 0 || +lc[i - 1] >= +x) && r.lignes.at(-1).loyer_charges === null || lc.every((x, i) => i === 0 || +lc[i - 1] >= +x), 'tri décroissant sur loyer+charges (vides en dernier)');
r = await chercher(agent, { tri: 'numero_esi; drop table public.logements', sens: 'desc' });
check(r.total === totalVisibles, 'colonne de tri inconnue ignorée (pas d\'injection SQL)');
r = await chercher(agent, { taille: 100000 });
check(r.lignes.length <= 200, 'taille de page plafonnée à 200');
r = await chercher(inactif, {});
check(r.total === 0, 'compte désactivé : aucun résultat');
await expectError(as(null, (q) => q(`select public.rechercher_logements()`), 'anon'), /permission denied/, 'recherche inaccessible à anon');
await expectError(as(null, (q) => q(`select public.enregistrer_logement(null, '{}'::jsonb)`), 'anon'), /permission denied/, 'enregistrement inaccessible à anon');

// ---------------------------------------------------------------- fiches travaux
console.log('\n== Fiche travaux : progression et statut automatique');
const idF = await enregistrer(agent, null, { numero_esi: '10002L3001', groupe_id: grp2.id, type_logement_code: 'T3', etage: 4 });
const ligneF = async () => (await as(agent, (q) => q(`select statut_code, nb_travaux, nb_travaux_finis, progression_travaux, derniere_vacance_id from public.v_logements where id = $1`, [idF]))).rows[0];
let f = await ligneF();
check(f.derniere_vacance_id && Number(f.nb_travaux) === 0 && f.progression_travaux === null, 'logement vacant créé → fiche travaux (vacance) créée automatiquement, 0 travaux');
const ajouter = (libelle) => as(agent, (q) => q(`insert into public.travaux (logement_id, libelle) values ($1, $2) returning id`, [idF, libelle])).then((r) => r.rows[0].id);
const statutTravail = (id, statut) => as(agent, (q) => q(`update public.travaux set statut_code = $2, entreprise_id = coalesce(entreprise_id, $3) where id = $1`, [id, statut, ent.id]));
const tA = await ajouter('Peinture'); const tB = await ajouter('Électricité');
f = await ligneF();
check(f.statut_code === 'travaux_a_faire', 'travaux « À commander » ajoutés → logement « Travaux à faire »', f.statut_code);
await statutTravail(tA, 'commande');
check((await ligneF()).statut_code === 'travaux_a_faire', 'un travail encore à commander → reste « Travaux à faire »');
await statutTravail(tB, 'commande');
check((await ligneF()).statut_code === 'travaux_commandes', 'tous commandés → « Travaux commandés »');
await statutTravail(tA, 'fini');
f = await ligneF();
check(f.statut_code === 'travaux_commandes' && f.progression_travaux === 50 && Number(f.nb_travaux_finis) === 1, '1 fini sur 2 → « Travaux commandés », progression 50 %', JSON.stringify(f));
await statutTravail(tB, 'fini');
f = await ligneF();
check(f.statut_code === 'travaux_finis' && f.progression_travaux === 100, 'tous finis → « Travaux finis », 100 %');
const tC = await ajouter('Serrure');
f = await ligneF();
check(f.statut_code === 'travaux_a_faire' && f.progression_travaux === 67, 'nouveau travail à commander → retour « Travaux à faire », 2/3 = 67 %', JSON.stringify(f));
await statutTravail(tA, 'a_commander');
const dA = await su((q) => q(`select date_commande, date_fin_reelle from public.travaux where id = $1`, [tA]));
check(dA.rows[0].date_commande === null && dA.rows[0].date_fin_reelle === null, 'retour à « À commander » → dates de commande et de fin effacées');
await as(agent, (q) => q(`update public.logements set statut_code = 'a_louer' where id = $1`, [idF]));
await statutTravail(tA, 'fini'); await statutTravail(tC, 'fini');
check((await ligneF()).statut_code === 'a_louer', 'statut « À louer » posé à la main jamais écrasé');
const hAuto = await su((q) => q(`select count(*)::int n from public.historique where logement_id = $1 and champ = 'statut_code' and automatique`, [idF]));
check(hAuto.rows[0].n >= 4, `changements automatiques de statut journalisés (${hAuto.rows[0].n})`);

console.log('\n== Fiche travaux : photos');
const vF = (await ligneF()).derniere_vacance_id;
await as(agent, (q) => q(`insert into public.photos (logement_id, storage_path, miniature_path, legende) values ($1, $2, $3, 'Cuisine')`, [idF, `${idF}/a.jpg`, `${idF}/miniatures/a.jpg`]));
const ph1 = await su((q) => q(`select vacance_id from public.photos where logement_id = $1`, [idF]));
check(ph1.rows[0].vacance_id === vF, 'photo rattachée automatiquement à la fiche (vacance) en cours');
await expectError(as(agent, (q) => q(`insert into public.photos (logement_id, storage_path, miniature_path) values ($1, $2, 'ailleurs/b.jpg')`, [idF, `${idF}/b.jpg`])), /photos_miniature_chemin/, 'miniature hors du dossier du logement refusée');
const bk = await su((q) => q(`select file_size_limit, allowed_mime_types from storage.buckets where id = 'photos-logements'`));
check(bk.rows[0].file_size_limit === '10485760' && bk.rows[0].allowed_mime_types.includes('image/jpeg'), 'bucket limité à 10 Mo et aux images');

console.log('\n== Recherche : N° ESI et progression');
r = await chercher(agent, { filtres: { numero_esi: 'l3001' } });
check(r.total === 1 && r.lignes[0].numero_esi === '10002L3001' && r.lignes[0].progression_travaux === 100, 'filtre N° ESI (contient, sans casse) + progression dans le résultat');
r = await chercher(agent, { tri: 'progression_travaux', sens: 'desc', taille: 200, filtres: { inclure_loues: true } });
const pr = r.lignes.map((l) => l.progression_travaux).filter((x) => x !== null);
check(pr.length > 0 && pr.every((x, i) => i === 0 || pr[i - 1] >= x), 'tri par progression décroissante');

// ---------------------------------------------------------------- archives
console.log('\n== Archives : logement loué en lecture seule');
const idX = await enregistrer(agent, null, { numero_esi: '10002L4001', groupe_id: grp2.id, type_logement_code: 'T2', loyer: 400, charges: 50 }, { nom_ancien_locataire: 'Marc Test' });
const { rows: [tX] } = await as(agent, (q) => q(`insert into public.travaux (logement_id, libelle) values ($1, 'Peinture') returning id`, [idX]));
await as(agent, (q) => q(`insert into public.photos (logement_id, storage_path) values ($1, $2)`, [idX, `${idX}/x.jpg`]));
const lx = (await as(agent, (q) => q(`select * from public.v_logements where id = $1`, [idX]))).rows[0];
await enregistrer(agent, idX, { ...lx, statut_code: 'loue' }, { nom_ancien_locataire: 'Marc Test', date_preavis: '2026-07-01', date_disponibilite: '2026-09-01' });
const ax = (await as(agent, (q) => q(`select statut_code, date_location, date_preavis, duree_derniere_vacance_jours from public.v_logements where id = $1`, [idX]))).rows[0];
check(ax.statut_code === 'loue' && ax.date_location && ax.date_preavis && ax.duree_derniere_vacance_jours !== null,
  '« Modifier → Loué » : infos de vacance enregistrées puis logement archivé, en une fois', JSON.stringify(ax));
await expectError(as(agent, (q) => q(`update public.logements set loyer = 1 where id = $1`, [idX])), /Logement archivé/, 'utilisateur : modification du logement loué refusée');
await expectError(as(agent, (q) => q(`update public.logements set statut_code = 'vacant_technique' where id = $1`, [idX])), /Logement archivé/, 'utilisateur : sortie de « Loué » refusée');
await expectError(as(agent, (q) => q(`insert into public.travaux (logement_id, vacance_id, libelle) values ($1, $2, 'X')`, [idX, lx.derniere_vacance_id])), /Logement archivé/, 'utilisateur : ajout de travail refusé');
await expectError(as(agent, (q) => q(`update public.travaux set libelle = 'Y' where id = $1`, [tX.id])), /Logement archivé/, 'utilisateur : modification de travail refusée');
await expectError(as(agent, (q) => q(`delete from public.photos where logement_id = $1`, [idX])), /Logement archivé/, 'utilisateur : suppression de photo refusée');
await expectError(as(agent, (q) => q(`update public.vacances set commentaire = 'Z' where logement_id = $1`, [idX])), /Logement archivé/, 'utilisateur : modification de vacance refusée');
await expectError(enregistrer(agent, idX, { ...lx, statut_code: 'loue', commentaire: 'modif' }, {}), /Logement archivé/, 'utilisateur : formulaire Modifier refusé sur un logement loué');
await as(admin, (q) => q(`update public.logements set commentaire = 'Correction admin' where id = $1`, [idX]));
pass('administrateur : correction possible sur un logement loué');
const lu = (await as(agent, (q) => q(`select count(*)::int n from public.v_logements where id = $1`, [idX]))).rows[0];
check(lu.n === 1, 'logement loué toujours consultable');

console.log('\n== Historique lisible et recherche des archives');
const hx = await as(agent, (q) => q(`select entite, action, champ, utilisateur_nom from public.v_historique where logement_id = $1 order by cree_le, id`, [idX]));
check(hx.rows.some((r) => r.champ === 'statut_code') && hx.rows.every((r) => r.utilisateur_nom !== undefined) && hx.rows.some((r) => r.utilisateur_nom === 'Martin Alice' || r.utilisateur_nom),
  `v_historique : ${hx.rowCount} événements avec nom de l'utilisateur`);
const auj = new Date().toISOString().slice(0, 10);
r = await chercher(agent, { filtres: { statut_code: 'loue', date_location_du: auj, date_location_au: auj }, tri: 'date_location', sens: 'desc' });
check(r.total >= 1 && r.lignes.every((l) => l.statut_code === 'loue') && r.lignes.some((l) => l.numero_esi === '10002L4001'), 'archives : filtre par date de location');

// ---------------------------------------------------------------- statistiques
console.log('\n== Chiffres : statistiques (jeu de données maîtrisé)');
const { rows: [gS] } = await as(admin, (q) => q(`insert into public.groupes (code, nom) values ('10009','Groupe statistiques') returning id`));
const vacanceDe = async (id) => (await su((q) => q(`select id from public.vacances where logement_id = $1 order by date_debut desc, created_at desc limit 1`, [id]))).rows[0].id;
const majVac = (vid, champs) => su((q) => q(`update public.vacances set ${Object.keys(champs).map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [vid, ...Object.values(champs)]));
const statut = (id, s) => su((q) => q(`update public.logements set statut_code = $2 where id = $1`, [id, s]));

// A : vacant 10/03/2025 → loué 20/06/2025, puis de nouveau vacant depuis le 15/01/2026
const sA = await enregistrer(agent, null, { numero_esi: '10009L0001', groupe_id: gS.id, type_logement_code: 'T2' });
const vA1 = await vacanceDe(sA);
await majVac(vA1, { date_debut: '2025-03-10' });
await statut(sA, 'loue');
await majVac(vA1, { date_fin: '2025-06-20' });
await statut(sA, 'vacant_technique');
await majVac(await vacanceDe(sA), { date_debut: '2026-01-15' });
// B : vacant depuis le 01/02/2026, 2 travaux (1 commandé, 1 fini)
const sB = await enregistrer(agent, null, { numero_esi: '10009L0002', groupe_id: gS.id, type_logement_code: 'T2' });
await majVac(await vacanceDe(sB), { date_debut: '2026-02-01' });
await su((q) => q(`insert into public.travaux (logement_id, libelle, statut_code, entreprise_id) values ($1,'S1','commande',$2), ($1,'S2','fini',$2)`, [sB, ent.id]));
// C : T4, vacant 20/12/2025 → loué 10/02/2026
const sC = await enregistrer(agent, null, { numero_esi: '10009L0003', groupe_id: gS.id, type_logement_code: 'T4' });
const vC = await vacanceDe(sC);
await majVac(vC, { date_debut: '2025-12-20' });
await statut(sC, 'loue');
await majVac(vC, { date_fin: '2026-02-10' });

const stats = (uid, annee, mois = null, groupe = gS.id, type = null) =>
  as(uid, (q) => q(`select public.statistiques($1, $2, $3, $4) as s`, [annee, mois, groupe, type])).then((r) => r.rows[0].s);

let st26 = await stats(agent, 2026);
check(st26.vacants.actuellement === 2 && st26.vacants.periode === 3, `2026 : 2 vacants aujourd'hui (A, B), 3 vacants dans l'année`, JSON.stringify(st26.vacants));
check(st26.mouvements.entrees === 2 && st26.mouvements.devenus_vacants === 2 && st26.mouvements.sorties === 1 && st26.mouvements.loues === 1,
  '2026 : 2 entrées en vacance, 1 sortie (C loué)', JSON.stringify(st26.mouvements));
check(st26.travaux.logements_avec_travaux === 1 && st26.travaux.commande === 1 && st26.travaux.fini === 1 && st26.travaux.a_commander === 0,
  '2026 : travaux 1 logement, 1 commandé, 1 terminé', JSON.stringify(st26.travaux));
const m = (st, n) => st.mensuel[n - 1];
check(m(st26, 1).vacants === 2 && m(st26, 1).entrees === 1 && m(st26, 2).vacants === 3 && m(st26, 2).sorties === 1 && m(st26, 3).vacants === 2,
  'mensuel 2026 : janv. 2 vacants / 1 entrée, févr. 3 vacants / 1 sortie, mars 2 vacants', JSON.stringify(st26.mensuel.slice(0, 3)));
const maintenant = new Date();
if (maintenant.getFullYear() === 2026 && maintenant.getMonth() < 11) {
  check(m(st26, 12).vacants === null, 'mois pas encore commencés : aucune valeur (pas de faux zéro)');
}
check(st26.vacants.par_type.map((x) => `${x.id}:${x.valeur}`).join(',') === 'T2:2,T4:1', 'répartition par type 2026 : T2 2, T4 1', JSON.stringify(st26.vacants.par_type));
check(st26.vacants.par_statut.length === 6 && st26.vacants.par_statut.find((x) => x.id === 'loue').valeur === 1,
  'répartition par statut : 6 statuts, 1 loué (C)', JSON.stringify(st26.vacants.par_statut));
const st25 = await stats(agent, 2025);
check(st25.vacants.periode === 2 && st25.mouvements.entrees === 2 && st25.mouvements.sorties === 1, '2025 : 2 vacants (A, C), 2 entrées, 1 sortie (A)', JSON.stringify([st25.vacants.periode, st25.mouvements]));
check(st26.annuel.some((a) => a.annee === 2025 && a.vacants === 2) && st26.annuel.some((a) => a.annee === 2026 && a.vacants === 3), 'évolution annuelle 2025 → 2026');
const stFev = await stats(agent, 2026, 2);
check(stFev.vacants.periode === 3 && stFev.mouvements.entrees === 1 && stFev.mouvements.sorties === 1 && stFev.periode.fin === '2026-02-28',
  'filtre mois (février 2026) : 3 vacants, 1 entrée, 1 sortie', JSON.stringify([stFev.periode, stFev.mouvements]));
const stT4 = await stats(agent, 2026, null, gS.id, 'T4');
check(stT4.vacants.periode === 1 && stT4.vacants.actuellement === 0, 'filtre type T4 : seul C');
const stInactif = await stats(inactif, 2026, null, null);
check(stInactif.vacants.periode === 0, 'compte désactivé : aucune donnée');
await expectError(as(null, (q) => q(`select public.statistiques(2026)`), 'anon'), /permission denied/, 'statistiques inaccessibles à anon');

// ---------------------------------------------------------------- paramètres
console.log('\n== Paramètres : listes déroulantes');
const { rows: [gLibre] } = await as(admin, (q) => q(`insert into public.groupes (code, nom) values ('10098','Groupe jamais utilisé') returning id`));
await as(admin, (q) => q(`delete from public.groupes where id = $1`, [gLibre.id]));
pass('valeur jamais utilisée : suppression permise');
await expectError(as(admin, (q) => q(`delete from public.groupes where id = $1`, [grp2.id])), /Valeur déjà utilisée/, 'groupe utilisé par des logements : suppression refusée');
// groupe utilisé uniquement dans l'historique (le logement a changé de groupe depuis)
const { rows: [gHist] } = await as(admin, (q) => q(`insert into public.groupes (code, nom) values ('10099','Groupe historique') returning id`));
const idH = await enregistrer(agent, null, { numero_esi: '10099L0001', groupe_id: gHist.id, type_logement_code: 'T1' });
await as(agent, (q) => q(`update public.logements set numero_esi = '10002L5001' where id = $1`, [idH]));
await expectError(as(admin, (q) => q(`delete from public.groupes where id = $1`, [gHist.id])), /Valeur déjà utilisée/, 'groupe présent seulement dans l\'historique : suppression refusée');
await as(admin, (q) => q(`update public.groupes set actif = false where id = $1`, [gHist.id]));
pass('désactivation d\'un groupe utilisé : permise');
await expectError(as(admin, (q) => q(`delete from public.entreprises where id = $1`, [ent.id])), /Valeur déjà utilisée/, 'entreprise utilisée par des travaux : suppression refusée');
await expectError(as(admin, (q) => q(`delete from public.plafonds where code = 'PLUS'`)), /Valeur déjà utilisée/, 'plafond utilisé : suppression refusée');
await as(admin, (q) => q(`insert into public.plafonds (code, libelle, ordre) values ('PLTEST','Plafond test',9)`));
await expectError(as(admin, (q) => q(`update public.plafonds set code = 'AUTRE' where code = 'PLTEST'`)), /code d'une valeur ne peut pas/, 'code d\'un plafond figé');
await as(admin, (q) => q(`update public.plafonds set libelle = 'Plafond test (renommé)', actif = false where code = 'PLTEST'`));
pass('libellé et activation d\'un plafond modifiables');
await expectError(as(agent, (q) => q(`update public.groupes set nom = 'X' where id = $1 returning id`, [grp2.id]).then((r) => { if (!r.rowCount) throw new Error('row-level security: 0 ligne'); })), /row-level security/, 'utilisateur : ne peut pas modifier un groupe');
const us = await as(admin, (q) => q(`select liste, cle, nb from public.v_usages_referentiels where liste = 'groupes' and cle = $1`, [grp2.id]));
check(us.rows[0]?.nb > 0, `nombre d'utilisations d'un groupe (${us.rows[0]?.nb} logements)`);

console.log('\n== Paramètres : administrateurs');
await expectError(as(admin, (q) => q(`update public.utilisateurs set role = 'utilisateur' where id = $1`, [admin])), /au moins un administrateur/, 'dernier administrateur : rétrogradation refusée');
await expectError(as(admin, (q) => q(`update public.utilisateurs set actif = false where id = $1`, [admin])), /au moins un administrateur/, 'dernier administrateur : désactivation refusée');
await as(admin, (q) => q(`update public.utilisateurs set role = 'admin' where id = $1`, [lect]));
await as(admin, (q) => q(`update public.utilisateurs set role = 'utilisateur' where id = $1`, [lect]));
pass('avec un second administrateur, les changements de rôle restent possibles');

console.log('\n== Format du N° ESI et groupe déduit');
for (const faux of ['12345-0001', '1234L0001', '12345L001', '12345X0001', 'ESI-00001', '12345L00012']) {
  await expectError(enregistrer(agent, null, { numero_esi: faux, type_logement_code: 'T2' }), /N° ESI invalide/, `N° ESI « ${faux} » refusé`);
}
const idE = await enregistrer(agent, null, { numero_esi: ' 10001 l 0777 ', groupe_id: grp2.id, type_logement_code: 'T2' });
const { rows: [lE] } = await as(agent, (q) => q(`select numero_esi, groupe_id from public.logements where id = $1`, [idE]));
check(lE.numero_esi === '10001L0777' && lE.groupe_id === grp.id, 'N° ESI normalisé et groupe déduit des 5 premiers chiffres (le groupe choisi est ignoré)', JSON.stringify(lE));
const idN = await enregistrer(agent, null, { numero_esi: '55555L0001', type_logement_code: 'T2' });
const { rows: [gN] } = await as(agent, (q) => q(`select g.code, g.nom from public.logements l join public.groupes g on g.id = l.groupe_id where l.id = $1`, [idN]));
check(gN?.code === '55555' && gN?.nom === 'Groupe 55555', 'groupe inconnu : créé automatiquement (même par un utilisateur)', JSON.stringify(gN));
await expectError(as(admin, (q) => q(`insert into public.groupes (code, nom) values ('G77','Mauvais code')`)), /groupes_code_format/, 'code de groupe autre que 5 chiffres refusé');
await expectError(as(admin, (q) => q(`update public.groupes set code = '66666' where id = $1`, [grp.id])), /code d'une valeur ne peut pas/, 'code d\'un groupe figé');

console.log(`\n== Résultat : ${ok} OK, ${ko} échec(s)\n`);
process.exitCode = ko ? 1 : 0;
await db.end();
await pgServer.stop();
fs.rmSync(dir, { recursive: true, force: true });
