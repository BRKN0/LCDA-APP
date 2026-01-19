import { CommonModule } from '@angular/common';
import { Component, OnInit, NgZone } from '@angular/core';
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
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit {
  orderNotifications: Notifications[] = []; // (new orders)
  processNotifications: Notifications[] = [];
  reminders: Notifications[] = [];
  paymentDues: Notifications[] = [];
  paymentDeadlines: Notifications[] = [];
  lowStock: Notifications[] = [];
  loading: boolean = true;
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
            if (role) {
              await this.getNotifications();
            }
            this.hasFetchedNotifications = true;
          } else {
            this.loading = false;
          }
        });
      }
    });
  }
  async getNotifications() {
    this.loading = true;
    // reset all arrays
    this.orderNotifications = [];
    this.processNotifications = [];
    this.reminders = [];
    this.paymentDues = [];
    this.paymentDeadlines = [];
    this.lowStock = [];

    let query = this.supabase.from('notifications').select('*');

    // role-based query filtering
    if (this.userRole === 'cuts_employee') {
      query = query.eq('type', 'order').eq('order_type', 'laser');
    } else if (this.userRole === 'prints_employee') {
      query = query.eq('type', 'order').eq('order_type', 'print');
    } else if (this.userRole === 'scheduler') {
      query = query.eq('type', 'process');
    } else if (this.userRole === 'admin') {
      // admin pulls all their assigned or unassigned notifications
      query = query.or(`id_user.eq.${this.userId},id_user.is.null,and(type.eq.order,order_type.eq.sales)`);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (!error && data) {
      data.forEach((n: any) => {
        switch (n.type) {
          case 'order':
            if (this.userRole === 'admin' && n.order_type === 'sales') {
              this.orderNotifications.push(n);
            } else if (this.userRole !== 'admin') {
              this.orderNotifications.push(n);
            }
            break;

          case 'process':
            if (this.userRole === 'scheduler') {
              this.processNotifications.push(n);
            }
            break;

          case 'reminder':
            if (this.userRole === 'admin') this.reminders.push(n);
            break;

          case 'payment_due':
          case 'payment_deadline':
            if (this.userRole === 'admin') {
              if (n.type === 'payment_due') this.paymentDues.push(n);
              else this.paymentDeadlines.push(n);
            }
            break;

          case 'lowStock':
            if (this.userRole === 'admin') this.lowStock.push(n);
            break;
        }
      });
    }

    this.loading = false;
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
    const { error } = await this.supabase.from('notifications').insert([
      {
        description: reminderForm.description,
        type: 'reminder',
        due_date: reminderForm.due_date,
        // id_user handled by db trigger now DON'T set it here
      },
    ]);

    if (!error) {
      this.showAddReminderForm = false;
      this.getNotifications();
    }
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
    this.selectedNotification = { ...notification };
    this.showEditReminderForm = true;
  }

  closeModals() {
    this.showAddReminderForm = false;
    this.showEditReminderForm = false;
    this.selectedNotification = null;
  }

  async editReminder(notification: Notifications) {
    if (!notification) return;

    const { error } = await this.supabase
      .from('notifications')
      .update({
        description: notification.description,
        due_date: notification.due_date,
      })
      .eq('id_notification', notification.id_notification);

    if (!error) {
      this.closeModals();
      await this.getNotifications();
    }
  }
  async deleteNotification(selectedNotification: Notifications) {
    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('id_notification', selectedNotification.id_notification);

    if (!error) this.getNotifications();
  }
  get allFinanceNotifications(): Notifications[] {
    return [...this.paymentDeadlines, ...this.paymentDues];
  }
}
