import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { Workbook } from 'exceljs';
import request from 'supertest';
import { json } from 'express';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { User } from '../src/users/user.entity';
import { MatchesController } from '../src/matches/matches.controller';
import { MatchesService } from '../src/matches/matches.service';
import { PredictionsController } from '../src/predictions/predictions.controller';
import { PredictionsService } from '../src/predictions/predictions.service';

describe('Sprint 5 HTTP + PostgreSQL', () => {
  let app: INestApplication<Server>;
  let db: DataSource;
  let control: DataSource;
  let admin: string, player: string, player2: string;
  const schema = `sprint5_test_${process.pid}_${Date.now()}`;
  const future = (days = 3) =>
    new Date(Date.now() + days * 86400000).toISOString();
  const input = () => ({
    tournamentId: 1,
    stageId: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    scheduledTime: future(),
    lockMinutes: 15,
  });
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    const url = process.env.SPRINT5_TEST_DATABASE_URL;
    if (!url)
      throw new Error(
        'Set SPRINT5_TEST_DATABASE_URL to a disposable PostgreSQL database.',
      );
    control = new DataSource({ type: 'postgres', url });
    await control.initialize();
    await control.query(`CREATE SCHEMA "${schema}"`);
    db = new DataSource({
      type: 'postgres',
      url,
      entities: [User],
      extra: { options: `-c search_path=${schema}` },
    });
    await db.initialize();
    await db.query(
      readFileSync(
        resolve(__dirname, '../../sport_tournament.postgres.sql'),
        'utf8',
      ).replace(/^\uFEFF/, ''),
    );
    const jwt = new JwtService({ secret: 'isolated-sprint5-test-secret' });
    admin = jwt.sign({ sub: 1, email: 'admin@test.local', role: 'ADMIN' });
    player = jwt.sign({ sub: 2, email: 'player@test.local', role: 'PLAYER' });
    player2 = jwt.sign({ sub: 3, email: 'other@test.local', role: 'PLAYER' });
    const auth = new AuthService({} as UsersService, jwt);
    const module = await Test.createTestingModule({
      controllers: [MatchesController, PredictionsController],
      providers: [
        MatchesService,
        PredictionsService,
        { provide: getRepositoryToken(User), useValue: db.getRepository(User) },
        { provide: AuthService, useValue: auth },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.use(json({ limit: '8mb' }));
    await app.init();
    await db.query(`INSERT INTO users(id,email,full_name,role) VALUES
      (1,'admin@test.local','Admin','ADMIN'),(2,'player@test.local','Player','PLAYER'),(3,'other@test.local','Other','PLAYER');
      INSERT INTO tournaments(id,name,sport_type,format,created_by) VALUES (1,'Demo Cup','FOOTBALL','ROUND_ROBIN',1);
      INSERT INTO stages(id,tournament_id,name,sort_order) VALUES(1,1,'Group Stage',1);
      INSERT INTO teams(id,tournament_id,name) VALUES(1,1,'Team A'),(2,1,'Team B'),(3,1,'Crash');`);
  }, 30000);

  beforeEach(async () => {
    await db.query('DROP TRIGGER IF EXISTS fail_import ON matches');
    await db.query('TRUNCATE matches RESTART IDENTITY CASCADE');
    await db.query(
      "INSERT INTO teams(id,tournament_id,name) VALUES(3,1,'Crash') ON CONFLICT(id) DO NOTHING",
    );
    await db.query("UPDATE tournaments SET visibility='PUBLIC' WHERE id=1");
  });
  afterAll(async () => {
    await app?.close();
    if (db?.isInitialized) await db.destroy();
    if (control?.isInitialized) {
      await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await control.destroy();
    }
  });

  async function create(data = input()) {
    return (
      await http()
        .post('/matches')
        .set('Authorization', bearer(admin))
        .send(data)
        .expect(201)
    ).body.id as number;
  }
  async function workbook(rows: unknown[][]) {
    const book = new Workbook();
    const sheet = book.addWorksheet('Matches');
    sheet.addRow(['Home Team', 'Away Team', 'Kickoff Time']);
    rows.forEach((row) => sheet.addRow(row));
    return {
      tournamentId: 1,
      stageId: 1,
      fileName: 'matches.xlsx',
      contentBase64: Buffer.from(await book.xlsx.writeBuffer()).toString(
        'base64',
      ),
    };
  }
  async function vote(id: number, token = player, homeScore = 2) {
    return http()
      .put(`/predictions/${id}`)
      .set('Authorization', bearer(token))
      .send({ homeScore, awayScore: 1 });
  }

  it('requires signed tokens and admin permission for writes', async () => {
    await http().post('/matches').send(input()).expect(401);
    await http()
      .post('/matches')
      .set('Authorization', 'Bearer fake')
      .send(input())
      .expect(401);
    await http()
      .post('/matches')
      .set('Authorization', bearer(player))
      .send(input())
      .expect(403);
  });
  it('creates, updates, reads and deletes a manual match', async () => {
    const id = await create();
    await http()
      .put(`/matches/${id}`)
      .set('Authorization', bearer(admin))
      .send({ ...input(), homeTeamId: 2, awayTeamId: 1 })
      .expect(200);
    const list = await http()
      .get('/matches/page?search=Team%20B&status=PENDING')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(list.body.items[0]).toMatchObject({
      id,
      homeName: 'Team B',
      predictionLocked: false,
    });
    await http()
      .delete(`/matches/${id}`)
      .set('Authorization', bearer(admin))
      .expect(200);
    await http()
      .delete(`/matches/${id}`)
      .set('Authorization', bearer(admin))
      .expect(404);
  });
  it('rejects invalid relations, same team and past kickoff', async () => {
    for (const data of [
      { ...input(), homeTeamId: 999 },
      { ...input(), awayTeamId: 1 },
      { ...input(), scheduledTime: '2020-01-01T00:00:00Z' },
    ]) {
      await http()
        .post('/matches')
        .set('Authorization', bearer(admin))
        .send(data)
        .expect(400);
    }
  });
  it('imports 20 valid matches, all unlocked', async () => {
    const payload = await workbook(
      Array.from({ length: 20 }, (_, i) => ['Team A', 'Team B', future(i + 2)]),
    );
    const result = await http()
      .post('/matches/import')
      .set('Authorization', bearer(admin))
      .send(payload)
      .expect(201);
    expect(result.body).toEqual({ imported: 20, rejected: 0, errors: [] });
    expect(
      await db.query(
        'SELECT COUNT(*)::int AS count FROM matches WHERE prediction_locked=FALSE',
      ),
    ).toEqual([{ count: 20 }]);
  });
  it('imports 8 of 10 rows and returns the 2 invalid row numbers', async () => {
    const payload = await workbook([
      ...Array.from({ length: 8 }, (_, i) => [
        'Team A',
        'Team B',
        future(i + 2),
      ]),
      ['Missing', 'Team B', future()],
      ['Team A', 'Missing', future()],
    ]);
    const result = await http()
      .post('/matches/import')
      .set('Authorization', bearer(admin))
      .send(payload)
      .expect(201);
    expect(result.body.imported).toBe(8);
    expect(result.body.rejected).toBe(2);
    expect(result.body.errors.map((e: { row: number }) => e.row)).toEqual([
      10, 11,
    ]);
  });
  it('rejects past, same-team and malformed date rows while preserving valid rows', async () => {
    const payload = await workbook([
      ['Team A', 'Team B', '8h tối'],
      ['Team A', 'Team A', future()],
      ['Team A', 'Team B', '2020-01-01T00:00:00Z'],
      ['Team A', 'Team B', future()],
    ]);
    const result = await http()
      .post('/matches/import')
      .set('Authorization', bearer(admin))
      .send(payload)
      .expect(201);
    expect(result.body).toMatchObject({ imported: 1, rejected: 3 });
  });
  it('rejects corrupt files without creating matches', async () => {
    await http()
      .post('/matches/import')
      .set('Authorization', bearer(admin))
      .send({
        tournamentId: 1,
        stageId: 1,
        fileName: 'bad.xlsx',
        contentBase64: 'aGVsbG8=',
      })
      .expect(400);
    expect(
      await db.query('SELECT COUNT(*)::int AS count FROM matches'),
    ).toEqual([{ count: 0 }]);
  });
  it('prevents duplicate concurrent imports using the database constraint', async () => {
    const payload = await workbook([['Team A', 'Team B', future()]]);
    const results = await Promise.all(
      [0, 1].map(() =>
        http()
          .post('/matches/import')
          .set('Authorization', bearer(admin))
          .send(payload)
          .expect(201),
      ),
    );
    expect(results.reduce((n, r) => n + r.body.imported, 0)).toBe(1);
    expect(results.reduce((n, r) => n + r.body.rejected, 0)).toBe(1);
  });
  it('reports a row whose team is deleted after lookup, then imports the next valid row', async () => {
    const target = app.get<unknown>(MatchesService) as {
      insert(
        manager: EntityManager,
        input: Record<string, unknown>,
      ): Promise<unknown>;
    };
    const original = target.insert.bind(target);
    const spy = jest
      .spyOn(target, 'insert')
      .mockImplementationOnce(async (manager, data) => {
        // A separate pooled DB connection deletes the team after import's name lookup.
        await db.query('DELETE FROM teams WHERE id=3');
        return original(manager, data);
      });
    try {
      const payload = await workbook([
        ['Crash', 'Team B', future()],
        ['Team A', 'Team B', future(4)],
      ]);
      const result = await http()
        .post('/matches/import')
        .set('Authorization', bearer(admin))
        .send(payload)
        .expect(201);
      expect(result.body).toMatchObject({ imported: 1, rejected: 1 });
      expect(result.body.errors[0].row).toBe(2);
      expect(result.body.errors[0].message).toContain('không tồn tại');
    } finally {
      spy.mockRestore();
    }
  });
  it('rolls back all imported rows after an unexpected database failure', async () => {
    await db.query(`CREATE OR REPLACE FUNCTION crash_import() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.home_team_id=3 THEN RAISE EXCEPTION 'simulated failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_import BEFORE INSERT ON matches FOR EACH ROW EXECUTE FUNCTION crash_import();`);
    const payload = await workbook([
      ['Team A', 'Team B', future()],
      ['Crash', 'Team B', future(4)],
    ]);
    await http()
      .post('/matches/import')
      .set('Authorization', bearer(admin))
      .send(payload)
      .expect(500);
    expect(
      await db.query('SELECT COUNT(*)::int AS count FROM matches'),
    ).toEqual([{ count: 0 }]);
  });
  it('searches and filters matches beyond the original 300-row limit', async () => {
    await db.query(`INSERT INTO matches(tournament_id,stage_id,home_team_id,away_team_id,scheduled_time,status,home_placeholder)
      SELECT 1,1,NULL,NULL,NOW()+n*INTERVAL '1 day','PENDING',CASE WHEN n=305 THEN 'Needle' ELSE 'Other' END FROM generate_series(1,305) n`);
    const result = await http()
      .get('/matches/page?search=Needle&status=PENDING')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(result.body.total).toBe(1);
    expect(result.body.items[0].homeName).toBe('Needle');
    const empty = await http()
      .get('/matches/page?status=LIVE')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(empty.body.total).toBe(0);
  });
  it('saves and updates one vote per player and protects other players history', async () => {
    const id = await create();
    expect((await vote(id)).status).toBe(200);
    expect((await vote(id, player, 3)).status).toBe(200);
    const own = await http()
      .get('/predictions')
      .set('Authorization', bearer(player))
      .expect(200);
    expect(own.body.items[0]).toMatchObject({
      matchId: id,
      homeScore: 3,
      awayScore: 1,
    });
    expect(own.body.total).toBe(1);
    const other = await http()
      .get('/predictions')
      .set('Authorization', bearer(player2))
      .expect(200);
    expect(other.body.items).toEqual([]);
    await http()
      .delete(`/matches/${id}`)
      .set('Authorization', bearer(admin))
      .expect(409);
    await http()
      .put(`/matches/${id}`)
      .set('Authorization', bearer(admin))
      .send(input())
      .expect(409);
  });
  it('enforces lock, unlock and deadline on the server', async () => {
    const id = await create();
    await http()
      .put(`/matches/${id}/prediction-lock`)
      .set('Authorization', bearer(admin))
      .send({ locked: true })
      .expect(200);
    expect((await vote(id)).status).toBe(409);
    await http()
      .put(`/matches/${id}/prediction-lock`)
      .set('Authorization', bearer(admin))
      .send({ locked: false })
      .expect(200);
    expect((await vote(id)).status).toBe(200);
    await db.query(
      "UPDATE matches SET scheduled_time=NOW()+INTERVAL '5 minutes' WHERE id=$1",
      [id],
    );
    expect((await vote(id)).status).toBe(409);
  });
  it('validates lock input and returns 404 for missing matches', async () => {
    await http()
      .put('/matches/999/prediction-lock')
      .set('Authorization', bearer(admin))
      .send({ locked: true })
      .expect(404);
    await http()
      .put('/matches/1/prediction-lock')
      .set('Authorization', bearer(admin))
      .send({ locked: 'false' })
      .expect(400);
    await http()
      .put('/matches/1/prediction-lock')
      .set('Authorization', bearer(player))
      .send({ locked: true })
      .expect(403);
  });
  it('serializes voting with simultaneous manual locking', async () => {
    const id = await create();
    const [voted, locked] = await Promise.all([
      vote(id),
      http()
        .put(`/matches/${id}/prediction-lock`)
        .set('Authorization', bearer(admin))
        .send({ locked: true }),
    ]);
    expect([200, 409]).toContain(voted.status);
    expect(locked.status).toBe(200);
    expect((await vote(id)).status).toBe(409);
  });
  it('does not expose private matches or permit private-match votes', async () => {
    const id = await create();
    await db.query("UPDATE tournaments SET visibility='PRIVATE' WHERE id=1");
    const list = await http()
      .get('/matches/page')
      .set('Authorization', bearer(player))
      .expect(200);
    expect(list.body.items).toEqual([]);
    expect((await vote(id)).status).toBe(403);
  });
});
