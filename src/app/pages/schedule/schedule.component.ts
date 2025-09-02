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
};
function toOrderLite(raw: any): OrderLite | null {
  if (!raw) return null;
  // hack to force shit to work
  const o = Array.isArray(raw) ? raw[0] : raw;
  if (!o) return null;
  return {
    id_order: String(o.id_order),
    code: o.code ?? null,
    created_at: o.created_at ?? null,
    scheduler: o.scheduler ?? null,
  };
}
interface Cut {
  id: string;
  id_order: string | null;
  cutting_time: number;
  category: string | null;
  material_type: string | null;
  color: string | null;
  order: OrderLite;
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
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
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

  unscheduledCuts: Cut[] = [];
  scheduled: Block[] = [];

  lastDays = 7;
  recentCuts: Cut[] = [];
  orderCodeQuery = '';
  searchResults: Cut[] = [];

  selectedBlock: Block | null = null;

  constructor(private supabase: SupabaseService, private zone: NgZone) {}

  ngOnInit() {
    this.loadForDay();
    this.loadRecentCuts();
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
        order:orders (
          id_order,
          code,
          created_at,
          scheduler
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
        order: c.orders,
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
    orders (
      id_order,
      code,
      created_at,
      scheduler
    )
  `
      )
      .gte('orders.created_at', since.toISOString())
      .order('created_at', { referencedTable: 'orders', ascending: false });

    if (unsErr) {
      console.error('unscheduled fetch error', unsErr);
    }

    const scheduledIds = new Set(this.scheduled.map((b) => b.cutId));

    this.unscheduledCuts = (unscheduledData ?? [])
      .filter((c: any) => !scheduledIds.has(c.id))
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
      orders (
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
    const scheduledIds = new Set((scheduledRows || []).map((r) => r.id_cut));

    // normalize map orders payload to a flat OrderLite
    this.recentCuts = (data || [])
      .filter((c: any) => !scheduledIds.has(c.id))
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

    // Attach the order so the template can show scheduler/created_at/etc.
    this.searchResults = (cutRows || []).map((c: any) => ({
      ...c,
      order,
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
        .select('id_order, code, created_at, scheduler')
        .eq('id_order', cut.id_order)
        .maybeSingle();

      // ensure order is present
      if (!cut.order && cut.id_order) {
        const { data: ord, error } = await this.supabase
          .from('orders')
          .select('id_order, code, created_at, scheduler')
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
    // optionally return to unscheduled:
    this.unscheduledCuts.unshift(block.cut);
    if (this.selectedBlock?.cutId === block.cutId) this.selectedBlock = null;
  }

  autoPack() {
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

    const sorted = Array.from(distinct.values()).sort(
      (a, b) => (b.cutting_time || 0) - (a.cutting_time || 0)
    );
    for (const cut of sorted) this.addToSchedule(cut);
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
}
