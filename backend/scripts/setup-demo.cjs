const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { Workbook } = require('exceljs');
const { readFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const config = require('./demo-config.cjs');

async function main() {
  const client = new Client({
    host: config.DB_HOST,
    port: Number(config.DB_PORT),
    user: config.DB_USERNAME,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
  });
  await client.connect();
  try {
    // This script connects only to our named local demo DB. Initialize schema only when empty.
    const existing = await client.query(
      "SELECT to_regclass('public.users') AS name",
    );
    if (!existing.rows[0].name) {
      await client.query(
        readFileSync(
          path.resolve(__dirname, '../../sport_tournament.postgres.sql'),
          'utf8',
        ).replace(/^\uFEFF/, ''),
      );
    }
    const passwords = { admin: 'DemoAdmin1!', player: 'DemoPlayer1!' };
    const users = [];
    for (const [email, name, role, password] of [
      ['mentor.admin@tech.com', 'Demo Admin', 'ADMIN', passwords.admin],
      ['mentor.player@tech.com', 'Demo Player', 'PLAYER', passwords.player],
      ['mentor.other@tech.com', 'Other Player', 'PLAYER', passwords.player],
    ]) {
      const hash = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO users(email,full_name,role,password_hash)
        VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING`,
        [email, name, role, hash],
      );
      users.push(
        (await client.query('SELECT id FROM users WHERE email=$1', [email]))
          .rows[0].id,
      );
    }
    let tournament = (
      await client.query(
        "SELECT id FROM tournaments WHERE name='Sprint 5 Demo Cup' LIMIT 1",
      )
    ).rows[0];
    if (!tournament)
      tournament = (
        await client.query(
          `INSERT INTO tournaments(name,sport_type,format,status,created_by)
      VALUES('Sprint 5 Demo Cup','FOOTBALL','ROUND_ROBIN','UPCOMING',$1) RETURNING id`,
          [users[0]],
        )
      ).rows[0];
    const tid = tournament.id;
    await client.query(
      `INSERT INTO stages(tournament_id,name,sort_order,correct_points,exact_score_bonus)
      VALUES($1,'Group Stage',1,3,2) ON CONFLICT(tournament_id,sort_order) DO NOTHING`,
      [tid],
    );
    const sid = (
      await client.query(
        'SELECT id FROM stages WHERE tournament_id=$1 AND sort_order=1',
        [tid],
      )
    ).rows[0].id;
    const teams = [];
    for (const name of ['Team A', 'Team B', 'Team C', 'Team D']) {
      await client.query(
        'INSERT INTO teams(tournament_id,name) VALUES($1,$2) ON CONFLICT(tournament_id,name) DO NOTHING',
        [tid, name],
      );
      teams.push(
        (
          await client.query(
            'SELECT id FROM teams WHERE tournament_id=$1 AND name=$2',
            [tid, name],
          )
        ).rows[0].id,
      );
    }
    const kickoff = (days) => {
      const date = new Date();
      date.setUTCHours(12, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString();
    };
    for (let i = 0; i < 3; i++) {
      await client.query(
        `INSERT INTO matches(tournament_id,stage_id,home_team_id,away_team_id,scheduled_time,external_source)
        VALUES($1,$2,$3,$4,$5,'MANUAL') ON CONFLICT DO NOTHING`,
        [tid, sid, teams[i], teams[(i + 1) % 4], kickoff(i + 2)],
      );
    }
    const directory = path.resolve(__dirname, '../../demo');
    mkdirSync(directory, { recursive: true });
    for (const [file, count, invalid] of [
      ['matches-valid-20.xlsx', 20, 0],
      ['matches-partial-8-of-10.xlsx', 10, 2],
    ]) {
      const book = new Workbook();
      const sheet = book.addWorksheet('Matches');
      sheet.addRow(['Home Team', 'Away Team', 'Kickoff Time']);
      for (let i = 0; i < count; i++)
        sheet.addRow([
          i >= count - invalid ? 'Missing Team' : 'Team A',
          'Team B',
          new Date(
            new Date(kickoff(i + (invalid ? 40 : 10))).getTime() +
              (Date.now() % 60000),
          ).toISOString(),
        ]);
      sheet.columns.forEach((column) => {
        column.width = 32;
      });
      await book.xlsx.writeFile(path.join(directory, file));
    }
    console.log('Demo ready: Sprint 5 Demo Cup / Group Stage');
    console.log('Admin: mentor.admin@tech.com / DemoAdmin1!');
    console.log('Player: mentor.player@tech.com / DemoPlayer1!');
    console.log(
      'Excel samples: demo/ (import partial sample before valid sample to avoid duplicate rows).',
    );
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
