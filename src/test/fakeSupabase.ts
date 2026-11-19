/**
 * Cliente Supabase falso para tests (Vitest + RTL).
 *
 * Cada consulta queda registrada en `fake.calls` y se responde con el handler
 * configurado para su tabla (`fake.tables`) o RPC (`fake.rpcs`). Sin handler,
 * una lectura devuelve `[]` y una escritura `null`, ambas sin error.
 */

export type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

export interface FakeQuery {
  table: string;
  op: Op;
  columns?: string;
  payload?: unknown;
  filters: Array<[method: string, column: string, value: unknown]>;
  single: boolean;
}

export interface FakeError {
  message: string;
  code?: string;
}

export interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

export type QueryHandler = (q: FakeQuery) => FakeResult | Promise<FakeResult>;
export type RpcHandler = (args: Record<string, unknown>) => FakeResult | Promise<FakeResult>;

export interface FakeUser {
  id: string;
  email: string;
}

export interface FakeSession {
  user: FakeUser;
}

type AuthListener = (event: string, session: FakeSession | null) => void;

export type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

/** Cambio de `postgres_changes` tal como lo entrega Realtime. */
export interface FakeChange {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  table?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

type ChangeListener = { type: string; filter: Record<string, unknown>; callback: (payload: never) => void };

/**
 * Canal de Realtime falso: registra las suscripciones `postgres_changes` y deja que el test
 * emita cambios (`emitChange`) y estados de suscripción (`emitStatus`).
 */
export class FakeChannel {
  listeners: ChangeListener[] = [];
  statusCallback: ((status: ChannelStatus, err?: Error) => void) | null = null;
  subscribed = false;
  removed = false;

  constructor(
    private fake: FakeSupabase,
    readonly name: string,
  ) {}

  on(type: 'postgres_changes' | 'system', filter: Record<string, unknown>, callback: (payload: never) => void) {
    this.listeners.push({ type, filter, callback });
    return this;
  }

  subscribe(callback?: (status: ChannelStatus, err?: Error) => void) {
    this.subscribed = true;
    this.statusCallback = callback ?? null;
    if (this.fake.autoSubscribe) queueMicrotask(() => this.emitStatus('SUBSCRIBED'));
    return this;
  }

  emitChange(change: FakeChange) {
    if (this.removed) return;
    for (const { type, filter, callback } of this.listeners) {
      const event = filter.event ?? '*';
      if (type === 'postgres_changes' && (event === '*' || event === change.eventType)) {
        (callback as (payload: FakeChange) => void)({ schema: 'public', table: String(filter.table ?? ''), new: {}, old: {}, ...change });
      }
    }
  }

  /** Mensaje `system` de Realtime (p. ej. «Subscribed to PostgreSQL»). */
  emitSystem(payload: Record<string, unknown>) {
    if (this.removed) return;
    for (const { type, callback } of this.listeners) {
      if (type === 'system') (callback as (payload: Record<string, unknown>) => void)(payload);
    }
  }

  emitStatus(status: ChannelStatus) {
    if (!this.removed) this.statusCallback?.(status);
  }
}

export function ok(data: unknown = null): FakeResult {
  return { data, error: null };
}

export function fail(message = 'error', code?: string): FakeResult {
  return { data: null, error: { message, code } };
}

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  private q: FakeQuery;

  constructor(
    private fake: FakeSupabase,
    table: string,
  ) {
    this.q = { table, op: 'select', filters: [], single: false };
  }

  select(columns = '*') {
    // `.insert(...).select()` mantiene la operación de escritura
    if (this.q.op === 'select') this.q.columns = columns;
    return this;
  }

  insert(payload: unknown) {
    return this.write('insert', payload);
  }

  update(payload: unknown) {
    return this.write('update', payload);
  }

  upsert(payload: unknown) {
    return this.write('upsert', payload);
  }

  delete() {
    return this.write('delete', undefined);
  }

  private write(op: Op, payload: unknown) {
    this.q.op = op;
    this.q.payload = payload;
    return this;
  }

  private filter(method: string, column: string, value: unknown) {
    this.q.filters.push([method, column, value]);
    return this;
  }

  eq(column: string, value: unknown) {
    return this.filter('eq', column, value);
  }

  neq(column: string, value: unknown) {
    return this.filter('neq', column, value);
  }

  is(column: string, value: unknown) {
    return this.filter('is', column, value);
  }

  not(column: string, operator: string, value: unknown) {
    return this.filter(`not.${operator}`, column, value);
  }

  order(column: string, options?: unknown) {
    return this.filter('order', column, options ?? null);
  }

  single() {
    this.q.single = true;
    return this;
  }

  maybeSingle() {
    this.q.single = true;
    return this;
  }

  private async run(): Promise<FakeResult> {
    this.fake.calls.push(this.q);
    const handler = this.fake.tables[this.q.table];
    if (handler) return handler(this.q);
    return ok(this.q.op === 'select' && !this.q.single ? [] : null);
  }

  then<R1 = FakeResult, R2 = never>(
    onfulfilled?: ((value: FakeResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export class FakeSupabase {
  calls: FakeQuery[] = [];
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  storageCalls: Array<{ op: string; path: string | string[]; body?: unknown; options?: unknown }> = [];
  tables: Record<string, QueryHandler> = {};
  rpcs: Record<string, RpcHandler> = {};
  storageError: FakeError | null = null;
  channels: FakeChannel[] = [];
  /** Si es verdadero, cada canal recibe `SUBSCRIBED` justo después de suscribirse. */
  autoSubscribe = true;

  /** Cuentas válidas para `signInWithPassword` (correo → contraseña). */
  users = new Map<string, { id: string; password: string }>();
  session: FakeSession | null = null;
  private listeners = new Set<AuthListener>();
  resetRequests: Array<{ email: string; options?: unknown }> = [];
  resetHandler: (() => FakeResult) | null = null;
  updateUserHandler: ((attrs: { password?: string }) => FakeResult) | null = null;

  reset() {
    this.calls = [];
    this.rpcCalls = [];
    this.storageCalls = [];
    this.tables = {};
    this.rpcs = {};
    this.storageError = null;
    this.channels = [];
    this.autoSubscribe = true;
    this.users.clear();
    this.session = null;
    this.listeners.clear();
    this.resetRequests = [];
    this.resetHandler = null;
    this.updateUserHandler = null;
  }

  from(table: string) {
    return new FakeQueryBuilder(this, table);
  }

  channel(name: string) {
    const channel = new FakeChannel(this, name);
    this.channels.push(channel);
    return channel;
  }

  async removeChannel(channel: FakeChannel) {
    channel.removed = true;
    this.channels = this.channels.filter((c) => c !== channel);
    return 'ok' as const;
  }

  /** Último canal abierto con ese nombre (el que está escuchando la pantalla). */
  lastChannel(name?: string): FakeChannel {
    const found = [...this.channels].reverse().find((c) => !name || c.name === name);
    if (!found) throw new Error(`No hay ningún canal abierto${name ? ` con el nombre ${name}` : ''}`);
    return found;
  }

  /** Equivalente falso de `restGet` (lib/rest.ts): un SELECT anónimo con parámetros PostgREST. */
  async restGet(table: string, params: Record<string, string>) {
    const { select, ...rest } = params;
    const q: FakeQuery = {
      table,
      op: 'select',
      columns: select,
      filters: Object.entries(rest).map(([column, value]) => ['param', column, value]),
      single: false,
    };
    this.calls.push(q);
    const handler = this.tables[table];
    const result = handler ? await handler(q) : ok([]);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  /** Equivalente falso de `restRpc` (lib/rest.ts): lanza si el handler devuelve error (como un HTTP no 2xx). */
  async restRpc(name: string, args: Record<string, unknown> = {}) {
    const result = await this.rpc(name, args);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async rpc(name: string, args: Record<string, unknown> = {}) {
    this.rpcCalls.push({ name, args });
    const handler = this.rpcs[name];
    return handler ? handler(args) : ok(null);
  }

  /** Emite un evento de Auth a los suscriptores (p. ej. `PASSWORD_RECOVERY`). */
  emit(event: string, session: FakeSession | null = this.session) {
    this.session = session;
    for (const listener of this.listeners) listener(event, session);
  }

  auth = {
    getSession: async () => ({ data: { session: this.session }, error: null }),
    getUser: async () => ({ data: { user: this.session?.user ?? null }, error: null }),
    onAuthStateChange: (listener: AuthListener) => {
      this.listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => this.listeners.delete(listener) } } };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const account = this.users.get(email);
      if (!account || account.password !== password) {
        return { data: { session: null, user: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } };
      }
      const session = { user: { id: account.id, email } };
      this.emit('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    },
    signOut: async () => {
      this.emit('SIGNED_OUT', null);
      return { error: null };
    },
    resetPasswordForEmail: async (email: string, options?: unknown) => {
      this.resetRequests.push({ email, options });
      const result = this.resetHandler ? this.resetHandler() : ok({});
      return { data: result.data, error: result.error };
    },
    updateUser: async (attrs: { password?: string }) => {
      if (!this.session) return { data: { user: null }, error: { message: 'Auth session missing!' } };
      const result = this.updateUserHandler ? this.updateUserHandler(attrs) : ok({ user: this.session.user });
      return { data: result.data, error: result.error };
    },
  };

  storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, body: unknown, options?: unknown) => {
        this.storageCalls.push({ op: 'upload', path, body, options });
        return this.storageError ? { data: null, error: this.storageError } : { data: { path }, error: null };
      },
      remove: async (paths: string[]) => {
        this.storageCalls.push({ op: 'remove', path: paths });
        return { data: [], error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://fake.supabase.test/storage/v1/object/public/images/${path}` } }),
    }),
  };
}

export const fakeSupabase = new FakeSupabase();
