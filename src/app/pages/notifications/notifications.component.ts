import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { RoleService } from '../../services/role.service';
import { RouterOutlet } from '@angular/router';

interface Notifications {
  id_notification: string;
  created_at: string;
  type: string;
  description: string;
  id_invoice: string;
  id_order: string;
  id_expenses: string;
  id_material: string;
  due_date: string;
  id_user: string;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit {
  lowStock: Notifications[] = [];
  reminders: Notifications[] = [];
  cutsOrders: Notifications[] = [];
  printsOrders: Notifications[] = [];
  paymentDues: Notifications[] = [];
  paymentDeadlines: Notifications[] = [];
  loading: boolean = true;
  notifications: Notifications[] = [];
  showAddReminderForm = false;
  showEditReminderForm = false;
  selectedNotification: Notifications | null = null;
  userId: string = '';
  userRole: string | null = null;
  private hasFetchedNotifications = false;
  reminderForm: Notifications = {
    id_notification: '',
    created_at: '',
    type: 'reminder',
    description: '',
    id_invoice: '',
    id_order: '',
    id_expenses: '',
    id_material: '',
    due_date: '',
    id_user: this.userId,
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService
  ) {}

  async ngOnInit() {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(async () => {
          this.userId = session.user.id;

          await this.roleService.fetchAndSetUserRole(this.userId);
          const role = this.roleService.getCurrentRole();

          if (!role) {
            this.loading = false;
            return;
          }

          this.userRole = role;

          if (!this.hasFetchedNotifications) {
            if (role === 'admin') {
              await this.checkAllPendingInvoicesDeadlines();
              await this.getNotifications();
            } else {
              await this.getEmployeeNotifications();
            }
            this.hasFetchedNotifications = true;
          } else {
            this.loading = false;
          }
        });
      }
    });
  }

  async getEmployeeNotifications() {
    this.loading = true;
    if (this.userRole == 'cuts_employee') {
      this.cutsOrders = [];
      const { error, data } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('type', 'cuts');
      if (error) {
        return;
      }
      this.notifications = data as Notifications[];
      for (let i = 0; i < this.notifications.length; i++) {
        this.cutsOrders.push(this.notifications[i]);
      }
    } else if (this.userRole == 'prints_employee') {
      this.printsOrders = [];
      const { error, data } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('type', 'prints');
      if (error) {
        return;
      }
      this.notifications = data as Notifications[];
      for (let i = 0; i < this.notifications.length; i++) {
        this.printsOrders.push(this.notifications[i]);
      }
    }
    this.loading = false;
  }

  async getNotifications() {
    this.loading = true;
    const { error, data } = await this.supabase
      .from('notifications')
      .select('*')
      .or(`id_user.eq.${this.userId},id_user.is.null`);

    this.loading = false;

    if (error) {
      console.error('Error loading notifications:', error);
      return;
    }

    this.notifications = data as Notifications[];
    this.lowStock = [];
    this.reminders = [];
    this.printsOrders = [];
    this.cutsOrders = [];
    this.paymentDues = [];
    this.paymentDeadlines = [];

    for (let i = 0; i < this.notifications.length; i++) {
      switch (this.notifications[i].type) {
        case 'lowStock':
          this.lowStock.push(this.notifications[i]);
          break;
        case 'reminder':
          this.reminders.push(this.notifications[i]);
          break;
        case 'prints':
          this.printsOrders.push(this.notifications[i]);
          break;
        case 'cuts':
          this.cutsOrders.push(this.notifications[i]);
          break;
        case 'payment_due':
          this.paymentDues.push(this.notifications[i]);
          break;
        case 'payment_deadline':
          this.paymentDeadlines.push(this.notifications[i]);
          break;
        default:
          console.log(
            'notification type is unknown: ',
            this.notifications[i].type
          );
          break;
      }
    }
    this.loading = false;
  }

  // Verificar todas las facturas pendientes al cargar el módulo
  async checkAllPendingInvoicesDeadlines(): Promise<void> {
    try {
      const { data: invoices, error } = await this.supabase
        .from('invoices')
        .select(`
          *,
          orders!inner(
            *,
            clients(*),
            payments(*)
          )
        `)
        .eq('invoice_status', 'overdue')
        .not('due_date', 'is', null);

      if (error) {
        console.error('Error al obtener facturas:', error);
        return;
      }

      if (!invoices || invoices.length === 0) return;

      for (const invoice of invoices) {
        await this.checkSingleInvoiceDeadline(invoice);
      }

      // Recargar notificaciones después de verificar
      await this.getNotifications();
    } catch (error) {
      console.error('Error verificando plazos de pago:', error);
    }
  }

  async checkSingleInvoiceDeadline(invoice: any): Promise<void> {
    if (!invoice.due_date) return;

    const totalPaid = invoice.orders?.payments?.reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0
    ) || 0;

    const total = invoice.orders?.total || 0;
    const remainingBalance = total - totalPaid;

    if (remainingBalance <= 0) {
      await this.supabase
        .from('notifications')
        .delete()
        .eq('id_invoice', invoice.id_invoice)
        .eq('type', 'payment_deadline');
      return;
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - currentDate.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 3 && daysRemaining > 0) {
      const { data: existingNotification } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('id_invoice', invoice.id_invoice)
        .eq('type', 'payment_deadline')
        .maybeSingle();

      if (!existingNotification) {
        const notificationData = {
          type: 'payment_deadline',
          description: `Plazo de pago próximo a vencer: Factura ${invoice.code} - Cliente: ${invoice.orders.clients.name} - Faltan ${daysRemaining} día(s)`,
          id_invoice: invoice.id_invoice,
          due_date: invoice.due_date,
        };

        await this.supabase
          .from('notifications')
          .insert([notificationData]);
      }
    } else if (daysRemaining <= 0) {
      await this.supabase
        .from('notifications')
        .delete()
        .eq('id_invoice', invoice.id_invoice)
        .eq('type', 'payment_deadline');
    }
  }

  getUpdatedDescription(description: string): string {
    if (description.includes('low')) {
      return description.replace('low', 'bajo');
    } else if (description.includes('out')) {
      return description.replace('out', 'fuera');
    }
    return description;
  }
  async generateReminder(reminderForm: Notifications): Promise<void> {
    if (!this.userId) {
      console.warn('El ID del usuario no está definido.');
      return;
    }

    const notificationToInsert = {
      description: reminderForm.description,
      type: 'reminder',
      due_date: reminderForm.due_date,
      id_user: this.userId,
    };

    const { error } = await this.supabase
      .from('notifications')
      .insert([notificationToInsert]);

    if (error) {
      console.error('Error adding the notification: ', error);
      return;
    }

    this.showAddReminderForm = false;
    this.getNotifications();
  }
  async toggleReminderForm() {
    if (!this.showAddReminderForm) {
      this.reminderForm = {
        id_notification: '',
        created_at: '',
        type: 'reminder',
        description: '',
        id_invoice: '',
        id_order: '',
        id_expenses: '',
        id_material: '',
        due_date: '',
        id_user: this.userId,
      };
    }
    this.showAddReminderForm = !this.showAddReminderForm;
  }
  selectNotification(notification: Notifications) {
    this.selectedNotification = notification;
    this.toggleEditReminderForm();
  }
  async toggleEditReminderForm() {
    this.showEditReminderForm = !this.showEditReminderForm;
  }
  async editReminder(selectedNotification: Notifications) {
    this.selectedNotification = {
      id_notification: selectedNotification.id_notification,
      description: selectedNotification.description,
      created_at: selectedNotification.created_at,
      due_date: selectedNotification.due_date,
      type: selectedNotification.type,
      id_invoice: selectedNotification.id_invoice,
      id_order: selectedNotification.id_order,
      id_expenses: selectedNotification.id_expenses,
      id_material: selectedNotification.id_material,
      id_user: this.userId,
    };

    const { error } = await this.supabase
      .from('notifications')
      .update(selectedNotification)
      .eq('id_notification', selectedNotification.id_notification);
    if (error) {
      console.error('Error updating notification: ', error);
      return;
    }
    this.selectedNotification = null;
  }
  async deleteNotification(selectedNotification: Notifications) {
    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('id_notification', selectedNotification.id_notification);
    if (error) {
      return;
    }
    if (this.userRole == 'admin') {
      this.getNotifications();
    } else {
      this.getEmployeeNotifications();
    }
  }
}
