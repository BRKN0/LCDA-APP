import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

type UUID = string;
type OrderLite = {
  id_order: string | null | undefined;
  code: string | null | undefined;
  created_at: string | null | undefined;
  scheduler: string | null | undefined;
  description: string | null | undefined;
};
function toOrderLite(raw: any): OrderLite | null {
  if (!raw) return null;
  // probably not optimal
  const o = Array.isArray(raw) ? raw[0] : raw;
  if (!o) return null;
  return {
    id_order: String(o.id_order),
    code: o.code ?? null,
    created_at: o.created_at ?? null,
    scheduler: o.scheduler ?? null,
    description: o.description ?? null,
  };
}
interface Cut {
  id: string;
  id_order: string | null;
  cutting_time: number;
  category: string | null;
  material_type: string | null;
  color: string | null;
  order: OrderLite | null;
}

interface CutSchedule {
  id?: UUID;
  id_cut: UUID;
  scheduled_date: string; // 'YYYY-MM-DD'
  scheduled_start: number; // minutes from midnight
  scheduled_end: number; // minutes from midnight
}

interface Block {
  cutId: UUID;
  actualDuration: number; // real duration (minutes) — ufor text, totals, saving
  visualDuration: number; // clamped to MIN_BLOCK_MIN — for layout height/overlap
  startMin: number; // scheduled start (minutes from midnight)
  endMin: number; // scheduled end using actualDuration
  endMinVisual: number; // startMin + visualDuration (for layout only)
  cut: Cut;
}
@Component({
  selector: 'app-schedule',
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss'],
})
export class ScheduleComponent implements OnInit {
  readonly DAY_START = 9 * 60; // 540
  readonly DAY_END = 17 * 60; // 1020
  readonly DAY_TOTAL = 8 * 60; // 480
  readonly MIN_BLOCK_PX = 32;
  readonly GAP_MIN = 4; // visual gap between blocks
  readonly MIN_BLOCK_MIN = 24; // minimum block height in minutes

  todayISO = new Date().toISOString().slice(0, 10);
  selectedDate: string = this.todayISO;
  lanesCount = 1;
  loading = false;
  saving = false;
  scheduledAllIds = new Set<string>();
  unscheduledCuts: Cut[] = [];
  scheduled: Block[] = [];
  timePickerVisible = false;
  timePickerValue = '09:00';
  pendingCut: Cut | null = null;
  lastDays = 7;
  recentCuts: Cut[] = [];
  orderCodeQuery = '';
  searchResults: Cut[] = [];

  selectedBlock: Block | null = null;

  constructor(private supabase: SupabaseService, private zone: NgZone) {}

  async ngOnInit() {
    await this.loadScheduledAllIds();
    await this.loadForDay();
    await this.loadRecentCuts();
  }

  fmt(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  toClock(minFromMidnight: number) {
    return this.fmt(minFromMidnight);
  }

  get usedMinutes(): number {
    return this.scheduled.reduce((sum, b) => sum + b.actualDuration, 0);
  }
  get remainingMinutes(): number {
    return Math.max(0, this.DAY_TOTAL - this.usedMinutes);
  }
  private timeStrToMinutes(t: string): number {
    const [hh, mm] = t.split(':').map(Number);
    return hh * 60 + mm;
  }
  private async loadScheduledAllIds() {
    const { data, error } = await this.supabase
      .from('cut_schedule')
      .select('id_cut');

    if (!error) {
      this.scheduledAllIds = new Set((data || []).map((r: any) => r.id_cut));
    } else {
      console.error('loadScheduledAllIds error:', error);
      this.scheduledAllIds = new Set();
    }
  }
  private canPlaceAt(startMin: number, visualDuration: number): boolean {
    const endMinVisual = startMin + visualDuration;

    if (startMin < this.DAY_START || endMinVisual > this.DAY_END) return false;

    for (const b of this.scheduled) {
      const bStart = b.startMin;
      const bEnd = b.endMinVisual;
      const noOverlap =
        endMinVisual + this.GAP_MIN <= bStart ||
        startMin >= bEnd + this.GAP_MIN;
      if (!noOverlap) return false;
    }
    return true;
  }
  async loadForDay() {
    this.loading = true;

    const { data: scheduledRows, error: sErr } = await this.supabase
      .from('cut_schedule')
      .select(
        `
      id_cut,
      scheduled_date,
      scheduled_start,
      scheduled_end,
      cuts (
        id,
        id_order,
        cutting_time,
        category,
        material_type,
        color,
        order:orders!cuts_id_order_fkey (
          id_order,
          code,
          created_at,
          scheduler, 
          description
        )
      )
    `
      )
      .eq('scheduled_date', this.selectedDate)
      .order('scheduled_start', { ascending: true });

    if (sErr) {
      console.error('loadForDay error:', sErr);
      this.scheduled = [];
      this.loading = false;
      return;
    }

    this.scheduled = (scheduledRows || []).map((row: any) => {
      const c = row.cuts;
      const start = row.scheduled_start;
      const end = row.scheduled_end;

      const actual = Math.max(0, Math.round((end ?? start) - start));
      const visual = Math.max(actual, this.MIN_BLOCK_MIN);

      const cut: Cut = {
        id: c.id,
        id_order: c.id_order,
        cutting_time: c.cutting_time ?? actual,
        category: c.category ?? null,
        material_type: c.material_type ?? null,
        color: c.color ?? null,
        order: toOrderLite(c.orders),
      };

      return {
        cutId: cut.id,
        actualDuration: actual,
        visualDuration: visual,
        startMin: start,
        endMin: end,
        endMinVisual: start + visual,
        cut,
      } as Block;
    });

    // Respect persisted positions. Just sort by start; DO NOT normalize here.
    this.scheduled.sort((a, b) => a.startMin - b.startMin);
    await this.loadScheduledAllIds();

    const since = new Date();
    since.setDate(since.getDate() - 60);

    const { data: unscheduledData, error: unsErr } = await this.supabase
      .from('cuts')
      .select(
        `
    id,
    id_order,
    cutting_time,
    category,
    material_type,
    color,
    orders!cuts_id_order_fkey (
      id_order,
      code,
      created_at,
      scheduler,
      description
    )
  `
      )
      .gte('orders.created_at', since.toISOString())
      .order('created_at', { referencedTable: 'orders', ascending: false });

    if (unsErr) {
      console.error('unscheduled fetch error', unsErr);
    }

    this.unscheduledCuts = (unscheduledData ?? [])
      .filter((c: any) => !this.scheduledAllIds.has(c.id))
      .map(
        (c: any) =>
          ({
            id: c.id,
            id_order: c.id_order ?? null,
            cutting_time: c.cutting_time ?? 0,
            category: c.category ?? null,
            material_type: c.material_type ?? null,
            color: c.color ?? null,
            order: toOrderLite(c.orders),
          } as Cut)
      );

    this.loading = false;
  }

  onDateChange() {
    this.scheduled = [];
    this.unscheduledCuts = [];
    this.selectedBlock = null;
    this.loadForDay();
  }

  async loadRecentCuts() {
    const since = new Date();
    since.setDate(since.getDate() - (this.lastDays || 7));

    // cuts + related order
    const { data, error } = await this.supabase
      .from('cuts')
      .select(
        `
      id,
      id_order,
      cutting_time,
      category,
      material_type,
      color,
      orders!cuts_id_order_fkey (
        id_order,
        code,
        description,
        created_at,
        scheduler
      )
    `
      )
      // filter and sort using the related orders table
      .gte('orders.created_at', since.toISOString())
      .order('created_at', { referencedTable: 'orders', ascending: false });

    if (error) {
      console.error('loadRecentCuts error:', error);
      this.recentCuts = [];
      return;
    }
    // get all scheduled cut ids to exclude them from the recent list
    const { data: scheduledRows, error: schedErr } = await this.supabase
      .from('cut_schedule')
      .select('id_cut');

    if (schedErr) {
      console.error('scheduled check error:', schedErr);
    }

    await this.loadScheduledAllIds();
    // normalize map orders payload to a flat OrderLite
    this.recentCuts = (data || [])
      .filter((c: any) => !this.scheduledAllIds.has(c.id))
      .map((c: any) => ({
        id: c.id,
        id_order: c.id_order ?? null,
        cutting_time: c.cutting_time ?? 0,
        category: c.category ?? null,
        material_type: c.material_type ?? null,
        color: c.color ?? null,
        order: toOrderLite(c.orders),
      })) as Cut[];
  }

  onDaysChange() {
    this.loadRecentCuts();
  }

  async searchByOrderCode() {
    const q = (this.orderCodeQuery || '').trim();
    this.searchResults = [];
    if (!q) return;

    const codeNum = Number(q);
    if (!Number.isFinite(codeNum)) {
      return;
    }

    // 1) Find the order by code
    const { data: orderRows, error: orderErr } = await this.supabase
      .from('orders')
      .select('id_order, code, description, created_at, scheduler')
      .eq('code', codeNum)
      .limit(1);

    if (orderErr) {
      console.error('searchByOrderCode orders error:', orderErr);
      return;
    }
    const order = orderRows?.[0];
    if (!order) {
      // no order with that code
      this.searchResults = [];
      return;
    }

    // Fetch cuts for that order via the FK
    const { data: cutRows, error: cutsErr } = await this.supabase
      .from('cuts')
      .select('id, id_order, cutting_time, category, material_type, color')
      .eq('id_order', order.id_order)
      .order('id', { ascending: true });

    if (cutsErr) {
      console.error('searchByOrderCode cuts error:', cutsErr);
      return;
    }
    await this.loadScheduledAllIds();
    // Attach the order so the template can show scheduler/created_at/etc.
    this.searchResults = (cutRows || [])
      .filter((c: any) => !this.scheduledAllIds.has(c.id)) // <— filtra global
      .map((c: any) => ({
        ...c,
        order, // adjunta el order para mostrar code/scheduler
      })) as Cut[];
  }

  private findNextStart(duration: number): number | null {
    let cursor = this.DAY_START;
    for (const b of this.scheduled) {
      if (cursor + duration <= b.startMin) return cursor;
      cursor = Math.max(cursor, b.endMin);
    }
    return cursor + duration <= this.DAY_END ? cursor : null;
  }
  //helper to know if a cut is already on the schedule
  isScheduled = (id: UUID) => this.scheduled.some((b) => b.cutId === id);

  async addToSchedule(cut: Cut) {
    if (!cut?.id) return;
    if (this.isScheduled(cut.id)) return;
    if (!cut.order && cut.id_order) {
      const { data: ord } = await this.supabase
        .from('orders')
        .select('id_order, code, created_at, scheduler, description')
        .eq('id_order', cut.id_order)
        .maybeSingle();

      // ensure order is present
      if (!cut.order && cut.id_order) {
        const { data: ord, error } = await this.supabase
          .from('orders')
          .select('id_order, code, created_at, scheduler, description')
          .eq('id_order', cut.id_order)
          .maybeSingle();
        if (!error && ord) {
          cut = {
            ...cut,
            order: {
              id_order: String(ord.id_order),
              code: ord.code ?? null,
              created_at: ord.created_at ?? null,
              scheduler: ord.scheduler ?? null,
              description: ord.description ?? null
            },
          };
        }
      }
    }

    const duration = Math.max(0, Math.round(cut.cutting_time || 0));
    if (!duration) return;

    const actual = Math.max(0, Math.round(cut.cutting_time || 0));
    if (!actual) return;

    const visual = Math.max(actual, this.MIN_BLOCK_MIN);
    const start = this.findNextStart(visual); // use visual to find space
    if (start === null) {
      alert('No hay espacio disponible entre 09:00 y 17:00 para este corte.');
      return;
    }

    const block: Block = {
      cutId: cut.id,
      actualDuration: actual,
      visualDuration: visual,
      startMin: start,
      endMin: start + actual, // end for the REAL duration
      endMinVisual: start + visual, // end for the LAYOUT
      cut,
    };
    this.scheduled.push({
      cutId: cut.id,
      actualDuration: actual,
      visualDuration: visual,
      startMin: start,
      endMin: start + actual,
      endMinVisual: start + visual,
      cut,
    });
    this.normalizeOverlaps();
    this.scheduled.sort((a, b) => a.startMin - b.startMin);

    // remove from lists by id
    this.unscheduledCuts = this.unscheduledCuts.filter((u) => u.id !== cut.id);
    this.recentCuts = this.recentCuts.filter((u) => u.id !== cut.id);
    this.searchResults = this.searchResults.filter((u) => u.id !== cut.id);
  }

  removeFromSchedule(block: Block) {
    this.scheduled = this.scheduled.filter((b) => b.cutId !== block.cutId);
    this.normalizeOverlaps();
    this.unscheduledCuts.unshift(block.cut);
    if (this.selectedBlock?.cutId === block.cutId) this.selectedBlock = null;
  }

  private tryPlaceCut(cut: Cut): boolean {
    if (!cut?.id) return false;
    if (this.isScheduled(cut.id)) return false;

    const actual = Math.max(0, Math.round(cut.cutting_time || 0));
    if (!actual) return false;

    const visual = Math.max(actual, this.MIN_BLOCK_MIN);
    const start = this.findNextStart(visual);
    if (start === null) return false;

    // build block
    const block: Block = {
      cutId: cut.id,
      actualDuration: actual,
      visualDuration: visual,
      startMin: start,
      endMin: start + actual,
      endMinVisual: start + visual,
      cut,
    };

    this.scheduled.push(block);
    this.scheduled.sort((a, b) => a.startMin - b.startMin);

    // remove from side lists
    this.unscheduledCuts = this.unscheduledCuts.filter((u) => u.id !== cut.id);
    this.recentCuts = this.recentCuts.filter((u) => u.id !== cut.id);
    this.searchResults = this.searchResults.filter((u) => u.id !== cut.id);

    return true;
  }

  private buildPoolDistinct(): Cut[] {
    const pool = [
      ...this.unscheduledCuts,
      ...this.recentCuts.filter(
        (r) => !this.unscheduledCuts.find((u) => u.id === r.id)
      ),
      ...this.searchResults.filter(
        (s) => !this.unscheduledCuts.find((u) => u.id === s.id)
      ),
    ];
    const distinct = new Map<UUID, Cut>();
    pool.forEach((c) => distinct.set(c.id, c));
    return Array.from(distinct.values());
  }

  autoPack() {
    // source list, largest first
    const candidates = this.buildPoolDistinct().sort(
      (a, b) => (b.cutting_time || 0) - (a.cutting_time || 0)
    );

    // threshold of "too big to try" after a failure
    let denyGeq = Number.POSITIVE_INFINITY;

    for (const cut of candidates) {
      const size = Math.max(0, Math.round(cut.cutting_time || 0));

      // skip if already placed by previous loop
      if (this.isScheduled(cut.id)) continue;

      // if we previously failed with a cut of size X, skip any >= X
      if (size >= denyGeq) continue;

      // try to place; if fails, update threshold so we only try smaller ones
      const placed = this.tryPlaceCut(cut);
      if (!placed) {
        denyGeq = size; // ignore any next cuts with cutting_time >= this size
        continue;
      }
    }
  }

  clearDay() {
    for (const b of this.scheduled) this.unscheduledCuts.push(b.cut);
    this.scheduled = [];
    this.selectedBlock = null;
  }

  async saveSchedule() {
    if (!this.scheduled.length) {
      await this.supabase
        .from('cut_schedule')
        .delete()
        .eq('scheduled_date', this.selectedDate);
      await this.loadForDay();
      return;
    }

    this.saving = true;
    try {
      // Build rows to persist from current UI
      const rows = this.scheduled.map((b) => ({
        id_cut: b.cutId,
        scheduled_date: this.selectedDate,
        scheduled_start: b.startMin,
        scheduled_end: b.endMin,
      }));

      const newIds = rows.map((r) => r.id_cut);

      // Fetch existing ids for that date
      const { data: existing, error: exErr } = await this.supabase
        .from('cut_schedule')
        .select('id_cut')
        .eq('scheduled_date', this.selectedDate);

      if (exErr) throw exErr;

      // Compute which to delete (present in DB, not present in UI)
      const toDelete = (existing || [])
        .map((r) => r.id_cut)
        .filter((id) => !newIds.includes(id));

      if (toDelete.length) {
        const { error: delErr } = await this.supabase
          .from('cut_schedule')
          .delete()
          .eq('scheduled_date', this.selectedDate)
          .in('id_cut', toDelete);
        if (delErr) throw delErr;
      }

      //Upsert the current set
      const { error: upErr } = await this.supabase
        .from('cut_schedule')
        .upsert(rows);
      if (upErr) throw upErr;

      // Reload UI
      await this.loadForDay();
    } catch (e) {
      console.error('saveSchedule error:', e);
      alert('Error guardando el horario.');
    } finally {
      this.loadRecentCuts();
      this.saving = false;
    }
  }

  // ————— UI: select block to show cut info
  onBlockClick(b: Block) {
    this.selectedBlock = b;
  }
  closeDetails() {
    this.selectedBlock = null;
  }
  blockTopPx(b: Block) {
    return `${b.startMin - this.DAY_START}px`;
  }
  blockHeightPx(b: Block) {
    return `${b.visualDuration}px`;
  }

  private normalizeOverlaps() {
    this.scheduled.sort((a, b) => a.startMin - b.startMin);

    let lastEndVisual = this.DAY_START;
    for (const b of this.scheduled) {
      // enforce visual min
      b.visualDuration = Math.max(b.visualDuration, this.MIN_BLOCK_MIN);

      // earliest allowed start considering visual gap
      const minStart = lastEndVisual + this.GAP_MIN;

      if (b.startMin < minStart) {
        b.startMin = minStart;
        b.endMin = b.startMin + b.actualDuration; // keep REAL end
        b.endMinVisual = b.startMin + b.visualDuration; // layout end
      } else {
        b.endMin = b.startMin + b.actualDuration;
        b.endMinVisual = b.startMin + b.visualDuration;
      }

      // clamp to day end visually
      if (b.endMinVisual > this.DAY_END) {
        b.endMinVisual = this.DAY_END;
        b.startMin = Math.max(
          this.DAY_START,
          b.endMinVisual - b.visualDuration
        );
        b.endMin = b.startMin + b.actualDuration; // recompute real end
      }

      lastEndVisual = b.endMinVisual;
    }
  }
  openTimePicker(cut: Cut) {
    this.pendingCut = cut;
    const visual = Math.max(
      Math.round(cut.cutting_time || 0),
      this.MIN_BLOCK_MIN
    );
    const firstSlot = this.findNextStart(visual) ?? this.DAY_START;
    const hh = String(Math.floor(firstSlot / 60)).padStart(2, '0');
    const mm = String(firstSlot % 60).padStart(2, '0');
    this.timePickerValue = `${hh}:${mm}`;

    this.timePickerVisible = true;
  }

  cancelTimePicker() {
    this.pendingCut = null;
    this.timePickerVisible = false;
  }

  confirmTimePicker() {
    if (!this.pendingCut) return;
    const cut = this.pendingCut;

    if (!cut.order && cut.id_order) {
    }

    const actual = Math.max(0, Math.round(cut.cutting_time || 0));
    if (!actual) {
      this.cancelTimePicker();
      return;
    }

    const visual = Math.max(actual, this.MIN_BLOCK_MIN);
    const start = this.timeStrToMinutes(this.timePickerValue);

    if (!this.canPlaceAt(start, visual)) {
      alert(
        'Ese horario no está disponible (solapa con otro bloque o fuera de 9–5).'
      );
      return;
    }

    const block: Block = {
      cutId: cut.id,
      actualDuration: actual,
      visualDuration: visual,
      startMin: start,
      endMin: start + actual,
      endMinVisual: start + visual,
      cut,
    };
    this.scheduled.push(block);
    this.scheduled.sort((a, b) => a.startMin - b.startMin);

    this.unscheduledCuts = this.unscheduledCuts.filter((u) => u.id !== cut.id);
    this.recentCuts = this.recentCuts.filter((u) => u.id !== cut.id);
    this.searchResults = this.searchResults.filter((u) => u.id !== cut.id);

    this.cancelTimePicker();
  }
}
