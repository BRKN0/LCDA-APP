import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainBannerComponent } from '../main-banner/main-banner.component';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { RoleService } from '../../services/role.service';
import { RouterOutlet } from '@angular/router';

interface Orders {
  id_order: string;
  order_type: string;
  name: string;
  client_type: string;
  code: number;
  description: string;
  order_payment_status: string;
  order_completion_status: string;
  order_confirmed_status: string;
  order_delivery_status: string;
  notes: string;
  created_at: string;
  delivery_date: string;
  order_quantity: string;
  unitary_value: string | number;
  iva: string | number;
  subtotal: string | number;
  total: string | number;
  amount: string | number;
  id_client: string;
  payments?: Payment[];
  file_path: string;
  scheduler: string;
  extra_charges?: { description: string; amount: number }[];
  base_total?: number;
  stock_status?: 'fulfilled' | 'pending_stock' | 'partially_fulfilled';
  pending_quantity?: number; // Cantidad pendiente por falta de stock
}

interface Client {
  id_client: string;
  name: string;
  document_type: string;
  document_number: string;
  cellphone: string;
  nit: string;
  company_name: string;
  email: string;
  status: string;
  debt: number;
  address: string;
  city: string;
  province: string;
  postal_code: string;
}

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
  id_user: string | null;
}

interface Cuts {
  id: string;
  category: string;
  material_type: string;
  color: string;
  caliber: string;
  height: string;
  width: string;
  quantity: string;
  cutting_time: string;
  id_order: string;
}

interface Prints {
  id: string;
  material_type: string;
  category: string;
  caliber: string;
  color: string;
  laminating: boolean;
  die_cutting: boolean;
  assembly: boolean;
  printing: boolean;
  product_number: string;
  quantity: string;
  damaged_material: string;
  notes: string;
  id_order: string;
}

interface Payment {
  id_payment?: number;
  id_order: string;
  amount: number;
  payment_date?: string;
}

interface Invoice {
  id_invoice: string;
  created_at: string;
  invoice_status: string;
  id_order: string;
  code: string;
  payment_term: number;
  include_iva: boolean;
  due_date: string; // Nueva columna para almacenar la fecha de vencimiento
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
export class OrdersComponent implements OnInit {
  clients: Client[] = [];
  notificationToInsert: Partial<Notifications> = {};
  orderToInsert: Partial<Orders> = {};
  notificationDesc: string = '';
  userId: string | null = null;
  userRole: string | null = null;
  showModal: boolean = false;
  order_role_filter: string = '';
  isEditing: boolean = false;
  orders: Orders[] = [];
  selectedOrderTypeDetail: any | null = null;
  order: Orders | null = null;
  filteredOrdersList: Orders[] = [];
  selectedOrder: Orders | null = null;
  selectedOrderDetails: Orders[] | null = null;
  noResultsFound: boolean = false;
  loading: boolean = true;
  loadingDetails: boolean = true;
  searchQuery: string = '';
  searchByNameQuery: string = '';
  startDate: string = '';
  endDate: string = '';
  showPrints: boolean = true;
  showCuts: boolean = true;
  showSales: boolean = true;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  paginatedOrders: Orders[] = [];
  newPaymentAmount: number = 0;
  showEditPayment: boolean = false;
  selectedPayment: Payment | null = null;
  notificationMessage: string | null = null;
  private searchSubject = new Subject<void>();
  showCalculator: boolean = false;
  calculationType: 'prints' | 'cuts' | 'sales' | null = null;
  clientType: 'intermediary' | 'final' | null = null;
  lamination: boolean = false;
  pPrint: boolean = false;
  stamping: boolean = false;
  assemble: boolean = false;
  laminationValue: number = 2;
  printValue: number = 1.2;
  stampingValue: number = 1.2;
  assembleValue: number = 1.2;
  rollWidth: number = 0;
  measurement: number = 0;
  productNumber: number = 1;
  materialValue: number = 0;
  intermediaryPerMinute: number = 800;
  finalPerMinute: number = 1000;
  usageTime: number = 0;
  calculatorResult: number = 0;
  showAddClientModal = false;
  filteredClients: Client[] = [];
  newOrder: Partial<Orders> = {};
  newCut: Partial<Cuts> = {};
  newPrint: Partial<Prints> = {};
  allMaterials: any[] = [];
  selectedCategory: string = '';
  selectedType: string = '';
  selectedCaliber: string = '';
  selectedColor: string = '';
  selectedFile: File | null = null;
  uploadedFileName: string | null = null;
  uploadedFilePath: string | null = null;
  showStockWarningModal = false;
  stockWarningMessage = '';
  selectedScheduler: string = '';
  saleMode: 'none' | 'material' | 'product' = 'none';
  saleMaterialQuantity: number = 1;
  saleMaterialUnitPrice: number = 0;
  allProducts: any[] = [];
  selectedProductId: string = '';
  salesItems: any[] = [];
  isSaleModeLocked: boolean = false;

  newClient = {
    name: '',
    email: '',
    document_type: '',
    document_number: '0',
    company_name: '',
    cellphone: '0',
    address: '',
    status: '',
  };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly zone: NgZone,
    private readonly roleService: RoleService,
    private readonly routerOutlet: RouterOutlet
  ) {}

  async ngOnInit(): Promise<void> {
    this.supabase.authChanges((_, session) => {
      if (session) {
        this.zone.run(() => {
          this.userId = session.user.id;
          this.roleService.fetchAndSetUserRole(this.userId);
          this.roleService.role$.subscribe((role) => {
            this.userRole = role;
            if (role) {
              this.getOrders();
            }
          });

          this.getClients();
          this.getMaterials();
          this.getProducts();
        });
      } else {
        console.error('Usuario no autenticado.');
        this.orders = [];
        this.filteredOrdersList = [];
      }
    });
  }
  async getOrders(): Promise<void> {
    this.loading = true;
    let query = this.supabase.from('orders').select('*, payments(*)');

    if (this.userRole !== 'admin' && this.userRole !== 'scheduler') {
      switch (this.userRole) {
        case 'prints_employee':
          this.order_role_filter = 'print';
          break;
        case 'cuts_employee':
          this.order_role_filter = 'laser';
          break;
        default:
          break;
      }
      query = query.eq('order_type', this.order_role_filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener los pedidos:', error);
      this.loading = false;
      return;
    }
    this.orders = data as Orders[];

    let n = this.orders.length;
    let swapped: boolean;

    do {
      swapped = false;
      for (let i = 0; i < n - 1; i++) {
        if (this.orders[i].code < this.orders[i + 1].code) {
          [this.orders[i], this.orders[i + 1]] = [
            this.orders[i + 1],
            this.orders[i],
          ];
          swapped = true;
        }
      }
      n--;
    } while (swapped);
    this.updateFilteredOrders();
    this.loading = false;
  }

  async getClients(): Promise<void> {
    const { data, error } = await this.supabase.from('clients').select('*');
    if (error) {
      console.error('Error fetching clients:', error);
      return;
    }
    this.clients = data;
    this.filteredClients = [...this.clients];
  }

  async getMaterials(): Promise<void> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .neq('material_quantity', '0');

    if (error) {
      console.error('Error al cargar materiales:', error);
      return;
    }

    this.allMaterials = data || [];
  }

  async getProducts(): Promise<void> {
    const { data, error } = await this.supabase
      .from('products')
      .select('id, name, stock, price, code, category');

    if (error) {
      console.error('Error al cargar productos:', error);
      return;
    }
    this.allProducts = data || [];
  }

  openAddClientModal(): void {
    this.showAddClientModal = true;
  }

  closeAddClientModal(): void {
    this.showAddClientModal = false;
    this.newClient = {
      name: '',
      email: '',
      document_type: '',
      document_number: '',
      company_name: '',
      cellphone: '',
      address: '',
      status: '',
    };
  }

  async saveNewClient(): Promise<void> {
    if (!this.newClient.name) {
      alert('Por favor, escriba un nombre para el cliente.');
      return;
    }

    const { data, error } = await this.supabase
      .from('clients')
      .insert([this.newClient]);

    if (error) {
      console.error('Error añadiendo el cliente:', error);
      alert('Error al añadir el cliente.');
      return;
    }

    alert('Cliente añadido correctamente.');
    this.closeAddClientModal();
    await this.getClients();
  }

  isSale(): boolean {
    const t = this.newOrder?.order_type;
    return t === 'sales';
  }

  // Builds the row for `sales` (sales-material)
  private buildSaleRowMaterial(orderId: string, m: any) {
    return {
      id_order: orderId,
      item_type: 'material',
      product_id: null,
      material_id: m.id_material,
      quantity: Number(this.saleMaterialQuantity) || 0,
      unit_price: Number(this.saleMaterialUnitPrice) || 0,
      // snapshots útiles
      material_type: m?.type || '',
      caliber: m?.caliber || '',
      color: m?.color || '',
      category: m?.category || '',
    };
  }

  private isSaleActive(): boolean {
    return (
      this.newOrder?.order_type === 'sales' &&
      (this.saleMode === 'material' || this.saleMode === 'product')
    );
  }

  recalcSalesTotal(): void {
    if (!this.isSaleActive()) return;
    const q = Number(this.saleMaterialQuantity) || 0;
    const u = Number(this.saleMaterialUnitPrice) || 0;
    this.newOrder.base_total = q * u;
    this.updateOrderTotalWithExtras();
  }

  //Producto
  onProductChange(): void {
    const p = this.allProducts.find((x) => x.id === this.selectedProductId);
    if (p) {
      this.saleMaterialUnitPrice = Number(p.price) || 0; // autollenar
      if (!this.saleMaterialQuantity || this.saleMaterialQuantity <= 0) {
        this.saleMaterialQuantity = 1;
      }
    }
    this.recalcSalesTotal(); // actualiza base_total + total (extras)
  }

  private buildSaleRowProduct(orderId: string, p: any) {
    return {
      id_order: orderId,
      item_type: 'product',
      product_id: p.id,
      material_id: null,
      quantity: Number(this.saleMaterialQuantity) || 0,
      unit_price: Number(this.saleMaterialUnitPrice) || 0,
    };
  }

  getProductNameById(productId: string | null | undefined): string {
    if (!productId) return '';
    const product = this.allProducts?.find((p) => p.id === productId);
    return product ? product.name : '';
  }

  asNumber(v: any): number {
    return typeof v === 'number' ? v : Number(v || 0);
  }

  addSaleItem(): void {
    if (this.saleMode === 'none') {
      alert("Seleccione si va a vender material o producto.");
      return;
    }

    // bloqueo del modo después del primer ítem
    if (!this.isSaleModeLocked && this.salesItems.length >= 1) {
      this.isSaleModeLocked = true;
    }

    // === MATERIAL ===
    if (this.saleMode === 'material') {
      const m = this.getSelectedMaterial();
      if (!m) {
        alert("Seleccione un material completo.");
        return;
      }

      const qty = Number(this.saleMaterialQuantity);
      const price = Number(this.saleMaterialUnitPrice);

      if (qty <= 0 || price <= 0) {
        alert("Cantidad y precio deben ser mayores a cero.");
        return;
      }

      this.salesItems.push({
        mode: 'material',
        material: m,
        quantity: qty,
        unit_price: price,
        subtotal: qty * price,
      });
    }

    // === PRODUCTO ===
    if (this.saleMode === 'product') {
      const p = this.allProducts.find(x => x.id === this.selectedProductId);
      if (!p) {
        alert("Seleccione un producto.");
        return;
      }

      const qty = Number(this.saleMaterialQuantity);
      const price = Number(this.saleMaterialUnitPrice);

      if (qty <= 0 || price <= 0) {
        alert("Cantidad y precio deben ser mayores a cero.");
        return;
      }

      this.salesItems.push({
        mode: 'product',
        product: p,
        quantity: qty,
        unit_price: price,
        subtotal: qty * price,
      });
    }

    this.recalcSalesFromItems();
  }

  removeSaleItem(index: number): void {
    this.salesItems.splice(index, 1);

    if (this.salesItems.length === 0) {
      this.isSaleModeLocked = false;
    }

    this.recalcSalesFromItems();
  }

  recalcSalesFromItems(): void {
    let total = 0;
    for (const item of this.salesItems) {
      total += item.subtotal;
    }

    this.newOrder.base_total = total;
    this.updateOrderTotalWithExtras();
  }

  validateSalesStock(): boolean {
    for (const item of this.salesItems) {
      const available = parseFloat(item.material?.material_quantity ?? item.product?.stock ?? 0);
      if (available < item.quantity) {
        // Mostrar error al usuario
        this.showStockError(`No hay suficiente stock. Disponible: ${available}`);
        return false;
      }
    }
    return true;
  }


  async saveSaleItemsToSupabase(orderId: string): Promise<boolean> {
  let hasStockIssues = false;
  let totalPendingQty = 0;

  for (const item of this.salesItems) {
    // === MATERIAL ===
    if (item.mode === 'material') {
      const m = item.material;

      const { data: matData, error: matErr } = await this.supabase
        .from('materials')
        .select('material_quantity')
        .eq('id_material', m.id_material)
        .single();

      if (matErr || !matData) {
        alert("No se pudo leer stock del material.");
        return false;
      }

      const currentStock = Number(matData.material_quantity);
      const requestedQty = item.quantity;

      // Descontar solo lo que hay disponible
      let deductedQty = 0;
      if (currentStock >= requestedQty) {
        deductedQty = requestedQty;
      } else {
        deductedQty = currentStock;
        hasStockIssues = true;
        totalPendingQty += (requestedQty - currentStock);
      }

      // Actualizar stock (nunca negativo)
      const newQty = Math.max(currentStock - deductedQty, 0);

      const { error: updateErr } = await this.supabase
        .from('materials')
        .update({ material_quantity: newQty.toString() })
        .eq('id_material', m.id_material);

      if (updateErr) {
        console.error("Error actualizando stock:", updateErr);
        return false;
      }

      // Insertar en sales
      const row = {
        id_order: orderId,
        item_type: 'material',
        material_id: m.id_material,
        product_id: null,
        quantity: item.quantity, // Cantidad solicitada
        fulfilled_quantity: deductedQty, // NUEVO: Cantidad realmente descontada
        pending_quantity: requestedQty - deductedQty, // NUEVO: Cantidad pendiente
        unit_price: item.unit_price,
        line_total: item.subtotal,
        material_type: m.type,
        caliber: m.caliber,
        color: m.color,
        category: m.category,
      };

      const { error: insErr } = await this.supabase
        .from('sales')
        .insert([row]);

      if (insErr) {
        console.error("Error insertando línea de material:", insErr);
        return false;
      }
    }

    // === PRODUCTO ===
    if (item.mode === 'product') {
      const p = item.product;

      const { data: prodData, error: prodErr } = await this.supabase
        .from('products')
        .select('stock')
        .eq('id', p.id)
        .single();

      if (prodErr || !prodData) {
        alert("No se pudo leer stock del producto.");
        return false;
      }

      const currentStock = Number(prodData.stock);
      const requestedQty = item.quantity;

      // Descontar solo lo que hay disponible
      let deductedQty = 0;
      if (currentStock >= requestedQty) {
        deductedQty = requestedQty;
      } else {
        deductedQty = currentStock;
        hasStockIssues = true;
        totalPendingQty += (requestedQty - currentStock);
      }

      const newStock = Math.max(currentStock - deductedQty, 0);

      await this.supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', p.id);

      const row = {
        id_order: orderId,
        item_type: 'product',
        product_id: p.id,
        material_id: null,
        quantity: item.quantity,
        fulfilled_quantity: deductedQty, // NUEVO
        pending_quantity: requestedQty - deductedQty, // NUEVO
        unit_price: item.unit_price,
        line_total: item.subtotal,
      };

      const { error: insErr } = await this.supabase
        .from('sales')
        .insert([row]);

      if (insErr) {
        console.error("Error insertando línea de producto:", insErr);
        return false;
      }
    }
  }

  // Actualizar el estado de stock del pedido
  const stockStatus = hasStockIssues
    ? (totalPendingQty === this.salesItems.reduce((sum, i) => sum + i.quantity, 0) ? 'pending_stock' : 'partially_fulfilled')
    : 'fulfilled';

  await this.supabase
    .from('orders')
    .update({
      stock_status: stockStatus,
      pending_quantity: totalPendingQty
    })
    .eq('id_order', orderId);

  // Mostrar advertencia si hay problemas de stock
  if (hasStockIssues) {
    alert(` ADVERTENCIA: El pedido fue creado pero hay ${totalPendingQty} unidades pendientes por falta de stock.`);
  }

  return true;
}


  showNotification(message: string) {
    this.notificationMessage = message;
    setTimeout(() => {
      this.notificationMessage = null;
    }, 3000);
  }

  getTotalPayments(order: Orders): number {
    return order.payments && Array.isArray(order.payments)
      ? order.payments.reduce((sum, p) => sum + p.amount, 0)
      : 0;
  }

  async addPayment(order: Orders, amount: number): Promise<void> {
    if (!order || !order.id_order || amount <= 0) {
      this.showNotification('Por favor, ingrese un monto válido.');
      return;
    }

    const total = parseFloat(String(order.total)) || 0;
    const totalPaid = this.getTotalPayments(order);
    const remainingBalance = total - totalPaid;

    if (amount > remainingBalance) {
      this.showNotification(
        `El abono no puede exceder el monto pendiente de $${remainingBalance.toFixed(
          2
        )}.`
      );
      return;
    }

    const payment: Payment = {
      id_order: order.id_order,
      amount: amount,
    };

    try {
      const { data, error: insertError } = await this.supabase
        .from('payments')
        .insert([payment])
        .select();

      if (insertError || !data || data.length === 0) {
        console.error('Error al añadir el abono:', insertError);
        this.showNotification('Error al añadir el abono.');
        return;
      }

      const newPayment = data[0];
      newPayment.payment_date = new Date().toISOString();

      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', order.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      const newDebt = currentDebt - amount;

      const { error: updateError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newDebt > 0 ? 'overdue' : 'upToDate' })
        .eq('id_client', order.id_client);

      if (updateError) {
        console.error('Error al actualizar la deuda:', updateError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      if (!order.payments) {
        order.payments = [];
      }
      order.payments.push(newPayment);

      const updatedTotalPaid = this.getTotalPayments(order);
      const orderTotal = parseFloat(String(order.total)) || 0;
      const newStatus =
        updatedTotalPaid >= orderTotal && newDebt <= 0 ? 'upToDate' : 'overdue';

      await this.supabase
        .from('orders')
        .update({ order_payment_status: newStatus })
        .eq('id_order', order.id_order);

      await this.supabase
        .from('invoices')
        .update({ invoice_status: newStatus })
        .eq('id_order', order.id_order);

      await this.getOrders();

      this.newPaymentAmount = 0;
      this.showNotification('Abono añadido correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  async markClientAsUpToDate(clientId: string): Promise<void> {
    const { error: debtError } = await this.supabase
      .from('clients')
      .update({ debt: 0, status: 'upToDate' })
      .eq('id_client', clientId);

    if (debtError) {
      console.error('Error al actualizar el cliente:', debtError);
      this.showNotification('Error al marcar al cliente como "al día".');
    } else {
      this.showNotification('Cliente marcado como "al día". Deuda eliminada.');
    }
  }

  async updatePayment(): Promise<void> {
    if (!this.selectedPayment || !this.selectedPayment.id_payment) {
      this.showNotification('No se ha seleccionado un abono válido.');
      return;
    }

    try {
      const { data: originalPayment, error: fetchError } = await this.supabase
        .from('payments')
        .select('amount')
        .eq('id_payment', this.selectedPayment.id_payment)
        .single();

      if (fetchError || !originalPayment) {
        console.error('Error al obtener el abono original:', fetchError);
        this.showNotification('Error al obtener el abono original.');
        return;
      }

      const originalAmount = originalPayment.amount;
      const newAmount = this.selectedPayment.amount;
      const difference = newAmount - originalAmount;

      const { error: updateError } = await this.supabase
        .from('payments')
        .update({ amount: newAmount })
        .eq('id_payment', this.selectedPayment.id_payment);

      if (updateError) {
        console.error('Error al actualizar el abono:', updateError);
        this.showNotification('Error al actualizar el abono.');
        return;
      }

      const { data: clientData, error: clientError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', this.selectedOrder!.id_client)
        .single();

      if (clientError || !clientData) {
        console.error('Error al obtener la deuda del cliente:', clientError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      const currentDebt = clientData.debt || 0;
      const newDebt = currentDebt + difference;

      const { error: debtError } = await this.supabase
        .from('clients')
        .update({ debt: newDebt, status: newDebt > 0 ? 'overdue' : 'upToDate' })
        .eq('id_client', this.selectedOrder!.id_client);

      if (debtError) {
        console.error('Error al actualizar la deuda:', debtError);
        this.showNotification('Error al actualizar la deuda del cliente.');
        return;
      }

      if (this.selectedOrder && this.selectedOrder.payments) {
        const paymentIndex = this.selectedOrder.payments.findIndex(
          (p) => p.id_payment === this.selectedPayment!.id_payment
        );
        if (paymentIndex !== -1) {
          this.selectedOrder.payments[paymentIndex] = {
            ...this.selectedPayment,
          };
        }

        const totalPaid = this.getTotalPayments(this.selectedOrder);
        const orderTotal = parseFloat(String(this.selectedOrder.total)) || 0;
        const newStatus =
          totalPaid >= orderTotal && newDebt <= 0 ? 'upToDate' : 'overdue';

        await this.supabase
          .from('orders')
          .update({ order_payment_status: newStatus })
          .eq('id_order', this.selectedOrder.id_order);

        await this.supabase
          .from('invoices')
          .update({ invoice_status: newStatus })
          .eq('id_order', this.selectedOrder.id_order);

        await this.getOrders();
      }

      this.showEditPayment = false;
      this.selectedPayment = null;
      this.showNotification('Abono actualizado correctamente.');
    } catch (error) {
      console.error('Error inesperado:', error);
      this.showNotification('Ocurrió un error inesperado.');
    }
  }

  async deleteOrder(order: Orders): Promise<void> {
    if (confirm(`¿Eliminar orden #${order.code}?`)) {
      try {
        if (order.order_type === 'print') {
          const { error: deletePrintsError } = await this.supabase
            .from('prints')
            .delete()
            .eq('id_order', order.id_order);

          if (deletePrintsError) {
            console.error(
              'Error al eliminar registros de prints:',
              deletePrintsError
            );
            this.showNotification('Error al eliminar registros de prints.');
            return;
          }
        } else if (order.order_type === 'laser') {
          const { error: deleteCutsError } = await this.supabase
            .from('cuts')
            .delete()
            .eq('id_order', order.id_order);

          if (deleteCutsError) {
            console.error(
              'Error al eliminar registros de cuts:',
              deleteCutsError
            );
            this.showNotification('Error al eliminar registros de cuts.');
            return;
          }
        } else if (order.order_type === 'sales') {
          const { error: deleteSalesError } = await this.supabase
            .from('sales')
            .delete()
            .eq('id_order', order.id_order);

          if (deleteSalesError) {
            console.error(
              'Error al eliminar registros de sales:',
              deleteSalesError
            );
            this.showNotification('Error al eliminar registros de sales.');
            return;
          }
        }

        const { error: deleteNotificationsError } = await this.supabase
          .from('notifications')
          .delete()
          .eq('id_order', order.id_order);

        if (deleteNotificationsError) {
          console.error(
            'Error al eliminar notificaciones:',
            deleteNotificationsError
          );
          this.showNotification('Error al eliminar notificaciones asociadas.');
          return;
        }

        const { error: deleteInvoicesError } = await this.supabase
          .from('invoices')
          .delete()
          .eq('id_order', order.id_order);

        if (deleteInvoicesError) {
          console.error(
            'Error al eliminar facturas asociadas:',
            deleteInvoicesError
          );
          this.showNotification('Error al eliminar facturas asociadas.');
          return;
        }

        const { error: deletePaymentsError } = await this.supabase
          .from('payments')
          .delete()
          .eq('id_order', order.id_order);

        if (deletePaymentsError) {
          console.error(
            'Error al eliminar pagos asociados:',
            deletePaymentsError
          );
          this.showNotification('Error al eliminar pagos asociados.');
          return;
        }

        const orderTotal = parseFloat(String(order.total)) || 0;
        const { data: clientData, error: clientError } = await this.supabase
          .from('clients')
          .select('debt')
          .eq('id_client', order.id_client)
          .single();

        if (clientError || !clientData) {
          console.error('Error al obtener la deuda del cliente:', clientError);
          this.showNotification('Error al actualizar la deuda del cliente.');
          return;
        }

        const currentDebt = clientData.debt || 0;
        const newDebt = currentDebt - orderTotal;
        const newStatus = newDebt > 0 ? 'overdue' : 'upToDate';

        const { error: updateClientError } = await this.supabase
          .from('clients')
          .update({ debt: newDebt, status: newStatus })
          .eq('id_client', order.id_client);

        if (updateClientError) {
          console.error(
            'Error al actualizar la deuda del cliente:',
            updateClientError
          );
          this.showNotification('Error al actualizar la deuda del cliente.');
          return;
        }

        const { error: deleteOrderError } = await this.supabase
          .from('orders')
          .delete()
          .eq('id_order', order.id_order);

        if (deleteOrderError) {
          console.error('Error al eliminar el pedido:', deleteOrderError);
          this.showNotification('Error al eliminar el pedido.');
          return;
        }

        this.orders = this.orders.filter((o) => o.id_order !== order.id_order);
        this.updateFilteredOrders();
        this.showNotification('Orden eliminada correctamente.');
      } catch (error) {
        console.error('Error inesperado al eliminar la orden:', error);
        this.showNotification(
          'Ocurrió un error inesperado al eliminar la orden.'
        );
      }
    }
  }

  onSearchInputChange(): void {
    this.searchSubject.next();
  }

  async onSearch(): Promise<void> {
    if (!this.searchQuery.trim()) {
      this.updateFilteredOrders();
      return;
    }

    const { data, error } = await this.supabase
      .from('orders')
      .select('*, payments(*)')
      .eq('code', this.searchQuery.trim());

    if (error) {
      console.error('Error al buscar la orden:', error);
      this.noResultsFound = true;
      this.filteredOrdersList = [];
      this.updatePaginatedOrder();
      return;
    }

    this.filteredOrdersList = data as Orders[];
    this.noResultsFound =
      this.searchQuery.trim() !== '' && (!data || data.length === 0);
    this.currentPage = 1;
    this.updatePaginatedOrder();
  }

  updateFilteredOrders(): void {
    const allTypeCheckboxesOff =
      !this.showPrints && !this.showCuts && !this.showSales;

    this.filteredOrdersList = this.orders.filter((order) => {
      const orderDate = new Date(order.created_at);
      const matchesStartDate = this.startDate
        ? orderDate >= new Date(this.startDate)
        : true;
      const matchesEndDate = this.endDate
        ? orderDate <= new Date(this.endDate + 'T23:59:59')
        : true;
      const matchesDateRange = matchesStartDate && matchesEndDate;

      const matchesNameSearch =
        !this.searchByNameQuery ||
        order.name
          .toLowerCase()
          .includes(this.searchByNameQuery.toLowerCase().trim());

      const matchesScheduler =
        !this.selectedScheduler || order.scheduler === this.selectedScheduler;

      if (allTypeCheckboxesOff) {
        return matchesDateRange && matchesNameSearch && matchesScheduler;
      }

      const isPrintsFilter = this.showPrints && order.order_type === 'print';
      const isCutsFilter = this.showCuts && order.order_type === 'laser';
      const isSalesFilter = this.showSales && order.order_type === 'sales';

      const matchesType = isPrintsFilter || isCutsFilter || isSalesFilter;

      return (
        matchesType && matchesDateRange && matchesNameSearch && matchesScheduler
      );
    });

    this.noResultsFound =
      this.searchByNameQuery.trim() !== '' &&
      this.filteredOrdersList.length === 0;
    this.currentPage = 1;
    this.updatePaginatedOrder();
  }

  getUniqueSchedulers(): string[] {
    const schedulers = this.orders.map((o) => o.scheduler).filter(Boolean);
    return Array.from(new Set(schedulers));
  }

  async selectOrder(order: Orders) {
    this.loadingDetails = true;
    this.selectedOrderTypeDetail = [];

    if (order.order_type === 'print') {
      const { data, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order);

      if (error) {
        console.log(error);
      } else {
        this.selectedOrderTypeDetail = data;
      }
    } else if (order.order_type === 'laser') {
      const { data, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order);

      if (error) {
        console.log(error);
      } else {
        this.selectedOrderTypeDetail = data;
      }
    } else if (
      order.order_type === 'venta' ||
      order.order_type === 'sale' ||
      order.order_type === 'sales'
    ) {
      const { data, error } = await this.supabase
        .from('sales')
        .select('*')
        .eq('id_order', order.id_order);

      if (error) {
        console.log(error);
      } else {
        this.selectedOrderTypeDetail = data || [];
      }
    }

    this.selectedOrderDetails = [
      {
        ...order,
        extra_charges: order.extra_charges || [],
      },
    ];
    this.selectedOrder = order;
    this.loadingDetails = false;
  }

  getUniqueCategories(): string[] {
    return [...new Set(this.allMaterials.map((m) => m.category))];
  }

  getFilteredTypes(): string[] {
    return [
      ...new Set(
        this.allMaterials
          .filter((m) => m.category === this.selectedCategory)
          .map((m) => m.type)
      ),
    ];
  }

  getFilteredCalibers(): string[] {
    return [
      ...new Set(
        this.allMaterials
          .filter(
            (m) =>
              m.category === this.selectedCategory &&
              m.type === this.selectedType
          )
          .map((m) => m.caliber)
      ),
    ];
  }

  getFilteredColors(): string[] {
    return [
      ...new Set(
        this.allMaterials
          .filter(
            (m) =>
              m.category === this.selectedCategory &&
              m.type === this.selectedType &&
              m.caliber === this.selectedCaliber
          )
          .map((m) => m.color)
      ),
    ];
  }

  getSelectedMaterial(): any | undefined {
    return this.allMaterials.find(
      (m) =>
        m.category === this.selectedCategory &&
        m.type === this.selectedType &&
        m.caliber === this.selectedCaliber &&
        m.color === this.selectedColor
    );
  }

  async toggleOrderConfirmedStatus(order: Orders) {
    order.order_confirmed_status =
      order.order_confirmed_status === 'confirmed'
        ? 'notConfirmed'
        : 'confirmed';
    const { error } = await this.supabase
      .from('orders')
      .update({ order_confirmed_status: order.order_confirmed_status })
      .eq('id_order', order.id_order);
    if (error) {
      console.error(error);
    }
  }

  async toggleOrderCompletionStatus(order: Orders) {
    const newCompletionStatus = order.order_completion_status;
    const newDeliveryStatus =
      newCompletionStatus === 'finished' ? 'Completado' : 'toBeDelivered';

    const { error } = await this.supabase
      .from('orders')
      .update({
        order_completion_status: newCompletionStatus,
        order_delivery_status: newDeliveryStatus,
      })
      .eq('id_order', order.id_order);

    if (error) {
      console.error('Error actualizando estado:', error);
      // Revertir el cambio local en caso de error
      order.order_completion_status =
        order.order_completion_status === 'finished' ? 'standby' : 'finished';
    } else {
      // Actualizar localmente para reflejar el cambio inmediato
      order.order_delivery_status = newDeliveryStatus;
    }
  }

  async toggleOrderPaymentStatus(order: Orders) {
    const { error } = await this.supabase
      .from('orders')
      .update({ order_payment_status: order.order_payment_status })
      .eq('id_order', order.id_order);
    if (error) {
      console.error('Error actualizando estado:', error);
    }
  }

  toggleAddOrderForm(): void {
    this.isEditing = false;
    if (!this.showModal) {
      this.newOrder = {
        id_order: '',
        order_type: '',
        name: '',
        client_type: '',
        description: '',
        order_payment_status: 'overdue',
        created_at: new Date().toISOString(),
        delivery_date: '',
        order_quantity: '0',
        unitary_value: '',
        iva: '',
        subtotal: '',
        total: '0',
        extra_charges: [],
        amount: '',
        id_client: '',
        order_confirmed_status: 'notConfirmed',
        order_completion_status: 'standby',
        order_delivery_status: 'toBeDelivered',
        notes: '',
        file_path: '',
        scheduler: '',
      };
      this.salesItems = [];
      this.saleMode = 'none';
      this.saleMaterialQuantity = 1;
      this.saleMaterialUnitPrice = 0;
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';
      this.isSaleModeLocked = false;
    }
    this.showModal = !this.showModal;
    if (!this.showModal) {
      this.getOrders();
    }
  }

  async editOrder(order: Orders): Promise<void> {
    this.isEditing = true;
    this.showModal = true;

    this.newOrder = { ...order };

    // Normaliza fecha (tu col es timestamp/date)
    this.newOrder.delivery_date = order.delivery_date
      ? order.delivery_date.slice(0, 10)
      : '';

    // base_total calculates without breaking if extra_charges is not an array
    const extrasArray = Array.isArray(this.newOrder.extra_charges)
      ? this.newOrder.extra_charges
      : [];

    if (!this.newOrder.base_total || isNaN(Number(this.newOrder.base_total))) {
      if (this.newOrder.subtotal && !isNaN(Number(this.newOrder.subtotal))) {
        this.newOrder.base_total = Number(this.newOrder.subtotal);
      } else {
        const extrasSum = extrasArray.reduce(
          (sum: number, c: any) => sum + Number(c?.amount || 0),
          0
        );
        this.newOrder.base_total = Number(this.newOrder.total || 0) - extrasSum;
      }
    }

    // prints
    if (order.order_type === 'print') {
      const { data, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order)
        .maybeSingle();

      if (!error && data) this.newPrint = { ...data };

      this.selectedCategory = this.newPrint?.category ?? '';
      this.selectedType = this.newPrint?.material_type ?? '';
      this.selectedCaliber = this.newPrint?.caliber ?? '';
      this.selectedColor = this.newPrint?.color ?? '';

      // laser
    } else if (order.order_type === 'laser') {
      const { data, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order)
        .maybeSingle();

      if (!error && data) this.newCut = { ...data };

      this.selectedCategory = this.newCut?.category ?? '';
      this.selectedType = this.newCut?.material_type ?? '';
      this.selectedCaliber = this.newCut?.caliber ?? '';
      this.selectedColor = this.newCut?.color ?? '';

      // salesa
    } else if (this.newOrder.order_type === 'sales') {
      // === 1. Traer TODAS las líneas de ventas ===
      const { data: rows, error } = await this.supabase
        .from('sales')
        .select('item_type, product_id, material_id, quantity, unit_price, line_total, material_type, caliber, color, category')
        .eq('id_order', order.id_order);

      if (error) {
        console.error('editOrder > Error cargando ventas:', error);
        return;
      }

      // === 2. Resetear salesItems ===
      this.salesItems = [];

      if (!rows || rows.length === 0) {
        // No tiene líneas → pedido raro o cotización antigua
        this.saleMode = 'none';
        this.isSaleModeLocked = false;
        return;
      }

      // === 3. Insertar todas las líneas en salesItems[] ===
      for (const r of rows) {
        if (r.item_type === 'material') {
          this.salesItems.push({
            mode: 'material',
            material: {
              id_material: r.material_id,
              category: r.category,
              type: r.material_type,
              caliber: r.caliber,
              color: r.color
            },
            quantity: Number(r.quantity),
            unit_price: Number(r.unit_price),
            subtotal: Number(r.line_total)
          });
        }

        if (r.item_type === 'product') {
          const prod = this.allProducts.find(p => p.id === r.product_id);

          this.salesItems.push({
            mode: 'product',
            product: prod ? prod : { id: r.product_id, name: 'Producto eliminado' },
            quantity: Number(r.quantity),
            unit_price: Number(r.unit_price),
            subtotal: Number(r.line_total)
          });
        }
      }

      // === 4. Configurar el modo de venta (según la primera línea) ===
      const first = this.salesItems[0];

      this.saleMode = first.mode;
      this.isSaleModeLocked = true;

      // === 5. Limpiar selects para agregar nuevos ítems ===
      this.selectedProductId = '';
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';

      this.saleMaterialQuantity = 1;
      this.saleMaterialUnitPrice = 0;

      // === 6. Recalcular totales ===
      this.recalcSalesFromItems();
    }
  }

  async getUserName(): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('user_name')
      .eq('id', this.userId)
      .maybeSingle();

    return error || !data ? null : data.user_name;
  }

  async addOrder(newOrderForm: Partial<Orders>): Promise<void> {
    const selectedClient = this.clients.find(
      (client) => client.id_client === newOrderForm.id_client
    );
    newOrderForm.name = selectedClient ? selectedClient.name : '';

    const { data: clientData, error: clientError } = await this.supabase
      .from('clients')
      .select('debt, credit_limit')
      .eq('id_client', newOrderForm.id_client)
      .single();

    if (clientError || !clientData) {
      console.error('Error al obtener detalles del cliente:', clientError);
      alert('Error al verificar el cliente.');
      return;
    }

    const currentDebt = clientData.debt || 0;
    const creditLimit = clientData.credit_limit || 0;
    const orderAmount = parseFloat(newOrderForm.total as string) || 0;
    const newDebt = currentDebt + orderAmount;

    if (creditLimit > 0 && newDebt > creditLimit) {
      const confirmMessage = `El cliente ha excedido su límite de crédito por lo que su deuda actual aumentara en el caso de que el pedido sea autorizado.

        ¿Desea autorizar este pedido de todas formas?`;

      if (!confirm(confirmMessage)) {
        return;
      }
    }

    // Calcular subtotal antes de crear el objeto
    const total = parseFloat(newOrderForm.total as string) || 0;
    const extras =
      newOrderForm.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
    const subtotal = total - extras;

    this.newOrder = {
      order_type: newOrderForm.order_type,
      name: newOrderForm.name,
      client_type: newOrderForm.client_type,
      description: newOrderForm.description,
      order_payment_status: newOrderForm.order_payment_status || 'overdue',
      created_at: newOrderForm.created_at || new Date().toISOString(),
      delivery_date: newOrderForm.delivery_date,
      order_quantity: newOrderForm.order_quantity,
      unitary_value: newOrderForm.unitary_value || 0,
      iva: newOrderForm.iva || 0,
      subtotal: subtotal.toString(),
      total: newOrderForm.total || 0,
      amount: newOrderForm.amount || 0,
      id_client: newOrderForm.id_client,
      order_confirmed_status: newOrderForm.order_confirmed_status,
      order_completion_status: newOrderForm.order_completion_status,
      order_delivery_status: newOrderForm.order_delivery_status,
      notes: newOrderForm.notes,
      file_path: newOrderForm.file_path,
      extra_charges: newOrderForm.extra_charges || [],
      base_total: subtotal,
    };

    const deliveryDate = newOrderForm.delivery_date
      ? new Date(newOrderForm.delivery_date)
      : new Date();
    const paymentTerm = 0;
    const dueDate = new Date(
      deliveryDate.getTime() + paymentTerm * 24 * 60 * 60 * 1000
    );
    const dueDateISOString = dueDate.toISOString();

    if (this.isEditing) {
      if (!newOrderForm.id_order) {
        console.error('ID del pedido no definido para actualizar.');
        alert('Error: No se puede actualizar un pedido sin ID.');
        return;
      }

      this.newOrder.id_order = newOrderForm.id_order;

      if (this.newOrder.order_type === 'sales') {
        this.recalcSalesFromItems();
      }

      await this.handleFileUploadForOrder(this.newOrder.id_order!);

      this.selectedFile = null;
      this.uploadedFileName = null;
      const { error } = await this.supabase
        .from('orders')
        .update([this.newOrder])
        .eq('id_order', this.newOrder.id_order);

      if (error) {
        console.error('Error al actualizar el pedido:', error);
        return;
      }

      if (this.newOrder.order_type === 'print') {
        const selectedMaterial = this.getSelectedMaterial();

        let deductedQty = 0;
        let pendingQty = 0;

        if (selectedMaterial) {
          const quantityToUse = parseInt(this.newPrint.quantity || '0');
          const currentStock = parseFloat(selectedMaterial.material_quantity);

          // Calcular deducción
          if (currentStock >= quantityToUse) {
            deductedQty = quantityToUse;
          } else {
            deductedQty = currentStock;
            pendingQty = quantityToUse - currentStock;

            alert(
              `⚠️ ADVERTENCIA DE STOCK\n\n` +
              `Solicitado: ${quantityToUse}\n` +
              `Disponible: ${currentStock}\n` +
              `Pendiente: ${pendingQty}\n\n` +
              `El pedido se actualizó pero hay ${pendingQty} unidades pendientes por falta de stock.`
            );
          }

          const newStock = Math.max(currentStock - deductedQty, 0);

          await this.supabase
            .from('materials')
            .update({ material_quantity: newStock.toString() })
            .eq('id_material', selectedMaterial.id_material);
        }

        const printData = {
          ...this.newPrint,
          id_order: this.newOrder.id_order,
          material_type: selectedMaterial?.type || '',
          caliber: selectedMaterial?.caliber || '',
          color: selectedMaterial?.color || '',
          category: selectedMaterial?.category || '',
          fulfilled_quantity: deductedQty,
          pending_quantity: pendingQty,
        };

        const { data: existingPrint, error: printSearchError } =
          await this.supabase
            .from('prints')
            .select('id')
            .eq('id_order', this.newOrder.id_order)
            .maybeSingle();

        if (existingPrint) {
          const { error: printUpdateError } = await this.supabase
            .from('prints')
            .update(printData)
            .eq('id_order', this.newOrder.id_order);
          if (printUpdateError) {
            console.error('Error actualizando impresión:', printUpdateError);
            return;
          }
        } else {
          const { error: printInsertError } = await this.supabase
            .from('prints')
            .insert([printData]);
          if (printInsertError) {
            console.error('Error insertando impresión:', printInsertError);
            return;
          }
        }

        // Actualizar stock_status en orders
        const stockStatus = pendingQty > 0
          ? (deductedQty === 0 ? 'pending_stock' : 'partially_fulfilled')
          : 'fulfilled';

        await this.supabase
          .from('orders')
          .update({
            stock_status: stockStatus,
            pending_quantity: pendingQty
          })
          .eq('id_order', this.newOrder.id_order);

      } else if (this.newOrder.order_type === 'laser') {
        const selectedMaterial = this.getSelectedMaterial();

        let deductedQty = 0;
        let pendingQty = 0;

        if (selectedMaterial) {
          const quantityToUse = parseInt(this.newCut.quantity || '0');
          const currentStock = parseFloat(selectedMaterial.material_quantity);

          // Ya no bloqueamos, descontamos lo disponible
          if (currentStock >= quantityToUse) {
            // Hay suficiente stock
            deductedQty = quantityToUse;
          } else {
            // No hay suficiente stock - descontar solo lo disponible
            deductedQty = currentStock;
            pendingQty = quantityToUse - currentStock;

            alert(
              `⚠️ ADVERTENCIA DE STOCK\n\n` +
              `Solicitado: ${quantityToUse}\n` +
              `Disponible: ${currentStock}\n` +
              `Pendiente: ${pendingQty}\n\n` +
              `El pedido se actualizó pero hay ${pendingQty} unidades pendientes por falta de stock.`
            );
          }

          // Actualizar stock (nunca negativo)
          const newStock = Math.max(currentStock - deductedQty, 0);

          await this.supabase
            .from('materials')
            .update({ material_quantity: newStock.toString() })
            .eq('id_material', selectedMaterial.id_material);
        }

        const cutData = {
          ...this.newCut,
          id_order: this.newOrder.id_order,
          material_type: selectedMaterial?.type || '',
          caliber: selectedMaterial?.caliber || '',
          color: selectedMaterial?.color || '',
          category: selectedMaterial?.category || '',
          fulfilled_quantity: deductedQty,
          pending_quantity: pendingQty,
        };

        const { data: existingCut, error: cutSearchError } = await this.supabase
          .from('cuts')
          .select('id')
          .eq('id_order', this.newOrder.id_order)
          .maybeSingle();

        if (existingCut) {
          const { error: cutUpdateError } = await this.supabase
            .from('cuts')
            .update(cutData)
            .eq('id_order', this.newOrder.id_order);
          if (cutUpdateError) {
            console.error('Error actualizando corte:', cutUpdateError);
            return;
          }
        } else {
          const { error: cutInsertError } = await this.supabase
            .from('cuts')
            .insert([cutData]);
          if (cutInsertError) {
            console.error('Error insertando corte:', cutInsertError);
            return;
          }
        }

        // Actualizar stock_status en orders
        const stockStatus = pendingQty > 0
          ? (deductedQty === 0 ? 'pending_stock' : 'partially_fulfilled')
          : 'fulfilled';

        await this.supabase
          .from('orders')
          .update({
            stock_status: stockStatus,
            pending_quantity: pendingQty
          })
          .eq('id_order', this.newOrder.id_order);

      } else if (this.newOrder.order_type === 'sales') {
        const orderId = this.newOrder.id_order!;

        // 1. Eliminar las filas antiguas del pedido
        const { error: delErr } = await this.supabase
          .from('sales')
          .delete()
          .eq('id_order', orderId);

        if (delErr) {
          console.error('Error eliminando líneas antiguas de ventas:', delErr);
          return;
        }

        // 2. Insertar todas las nuevas líneas desde salesItems[]
        const rowsToInsert = this.salesItems.map(item => {
          if (item.mode === 'material') {
            return {
              id_order: orderId,
              item_type: 'material',
              product_id: null,
              material_id: item.material.id_material,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.subtotal,
              material_type: item.material.type,
              caliber: item.material.caliber,
              color: item.material.color,
              category: item.material.category
            };
          } else {
            return {
              id_order: orderId,
              item_type: 'product',
              product_id: item.product.id,
              material_id: null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.subtotal
            };
          }
        });

        const { error: insertErr } = await this.supabase
          .from('sales')
          .insert(rowsToInsert);

        if (insertErr) {
          console.error('Error insertando líneas nuevas de ventas:', insertErr);
          return;
        }
      }

      const { data: existingInvoice, error: invoiceError } = await this.supabase
        .from('invoices')
        .select('*')
        .eq('id_order', this.newOrder.id_order)
        .single();

      if (invoiceError && invoiceError.code !== 'PGRST116') {
        console.error('Error al buscar factura existente:', invoiceError);
        return;
      }

      if (existingInvoice) {
        const updatedInvoice: Partial<Invoice> = {
          due_date: dueDateISOString,
        };
        const { error: updateInvoiceError } = await this.supabase
          .from('invoices')
          .update(updatedInvoice)
          .eq('id_order', this.newOrder.id_order);

        if (updateInvoiceError) {
          console.error('Error al actualizar la factura:', updateInvoiceError);
          return;
        }
      }

      await this.getOrders();
      this.toggleAddOrderForm();
    } else {
      const userName = await this.getUserName();
      this.newOrder.scheduler = userName || '';

      if (this.newOrder.order_type === 'sales') {
        this.recalcSalesFromItems();
      }

      if (this.newOrder.order_type === 'sales') {
        const valid = await this.validateSalesStock();
        if (!valid) return;
        this.recalcSalesFromItems();
      }

      const { data, error } = await this.supabase
        .from('orders')
        .insert([this.newOrder])
        .select();

      if (error) {
        console.error('Error al añadir el pedido:', error);
        return;
      }

      const insertedOrder = data[0];
      this.newOrder.id_order = insertedOrder.id_order;
      this.newOrder.code = insertedOrder.code;

      await this.handleFileUploadForOrder(this.newOrder.id_order!);

      if (this.newOrder.order_type === 'print') {
        const selectedMaterial = this.getSelectedMaterial();

        let deductedQty = 0;
        let pendingQty = 0;

        if (selectedMaterial) {
          const quantityToUse = parseInt(this.newPrint.quantity || '0');
          const currentStock = parseFloat(selectedMaterial.material_quantity);

          // Ya no bloqueamos, descontamos lo disponible
          if (currentStock >= quantityToUse) {
            // Hay suficiente stock
            deductedQty = quantityToUse;
          } else {
            // No hay suficiente stock - descontar solo lo disponible
            deductedQty = currentStock;
            pendingQty = quantityToUse - currentStock;

            alert(
              `⚠️ ADVERTENCIA DE STOCK\n\n` +
              `Solicitado: ${quantityToUse}\n` +
              `Disponible: ${currentStock}\n` +
              `Pendiente: ${pendingQty}\n\n` +
              `El pedido se creó pero hay ${pendingQty} unidades pendientes por falta de stock.`
            );
          }

          // Actualizar stock (nunca negativo)
          const newStock = Math.max(currentStock - deductedQty, 0);

          await this.supabase
            .from('materials')
            .update({ material_quantity: newStock.toString() })
            .eq('id_material', selectedMaterial.id_material);
        }

        const printData = {
          ...this.newPrint,
          id_order: this.newOrder.id_order,
          material_type: selectedMaterial?.type || '',
          caliber: selectedMaterial?.caliber || '',
          color: selectedMaterial?.color || '',
          category: selectedMaterial?.category || '',
          fulfilled_quantity: deductedQty,
          pending_quantity: pendingQty,
        };

        const { error: printError } = await this.supabase
          .from('prints')
          .insert([printData]);

        if (printError) {
          console.error('Error al insertar datos de impresión:', printError);
          return;
        }

        // Actualizar stock_status en orders
        const stockStatus = pendingQty > 0
          ? (deductedQty === 0 ? 'pending_stock' : 'partially_fulfilled')
          : 'fulfilled';

        await this.supabase
          .from('orders')
          .update({
            stock_status: stockStatus,
            pending_quantity: pendingQty
          })
          .eq('id_order', this.newOrder.id_order);

        this.createNotification(insertedOrder);
      } else if (this.newOrder.order_type === 'laser') {
        const selectedMaterial = this.getSelectedMaterial();

        let deductedQty = 0;
        let pendingQty = 0;

        if (selectedMaterial) {
          const quantityToUse = parseInt(this.newCut.quantity || '0');
          const currentStock = parseFloat(selectedMaterial.material_quantity);

          //  Ya no bloqueamos, descontamos lo disponible
          if (currentStock >= quantityToUse) {
            // Hay suficiente stock
            deductedQty = quantityToUse;
          } else {
            // No hay suficiente stock - descontar solo lo disponible
            deductedQty = currentStock;
            pendingQty = quantityToUse - currentStock;

            alert(
              `⚠️ ADVERTENCIA DE STOCK\n\n` +
              `Solicitado: ${quantityToUse}\n` +
              `Disponible: ${currentStock}\n` +
              `Pendiente: ${pendingQty}\n\n` +
              `El pedido se creó pero hay ${pendingQty} unidades pendientes por falta de stock.`
            );
          }

          // Actualizar stock (nunca negativo)
          const newStock = Math.max(currentStock - deductedQty, 0);

          await this.supabase
            .from('materials')
            .update({ material_quantity: newStock.toString() })
            .eq('id_material', selectedMaterial.id_material);
        }

        // Agregar fulfilled_quantity y pending_quantity
        const cutData = {
          ...this.newCut,
          id_order: this.newOrder.id_order,
          material_type: selectedMaterial?.type || '',
          caliber: selectedMaterial?.caliber || '',
          color: selectedMaterial?.color || '',
          category: selectedMaterial?.category || '',
          fulfilled_quantity: deductedQty,
          pending_quantity: pendingQty,
        };

        const { error: cutError } = await this.supabase
          .from('cuts')
          .insert([cutData]);
        if (cutError) {
          console.error('Error al insertar datos de corte:', cutError);
          return;
        }

        // Actualizar stock_status en orders
        const stockStatus = pendingQty > 0
          ? (deductedQty === 0 ? 'pending_stock' : 'partially_fulfilled')
          : 'fulfilled';

        await this.supabase
          .from('orders')
          .update({
            stock_status: stockStatus,
            pending_quantity: pendingQty
          })
          .eq('id_order', this.newOrder.id_order);

        this.createNotification(insertedOrder);
      } else if (this.newOrder.order_type === 'sales') {
        const ok = await this.saveSaleItemsToSupabase(this.newOrder.id_order!);
        if (!ok) return;
      }

      const newInvoice: Partial<Invoice> = {
        created_at: new Date().toISOString(),
        invoice_status: 'overdue',
        id_order: insertedOrder.id_order,
        code: insertedOrder.code.toString(),
        payment_term: paymentTerm,
        include_iva: false,
        due_date: dueDateISOString,
      };

      const { error: invoiceInsertError } = await this.supabase
        .from('invoices')
        .insert([newInvoice]);

      if (invoiceInsertError) {
        console.error('Error al crear la factura:', invoiceInsertError);
        return;
      }

      const { data: clientData, error: clientUpdateError } = await this.supabase
        .from('clients')
        .select('debt')
        .eq('id_client', insertedOrder.id_client)
        .single();

      if (clientUpdateError || !clientData) {
        console.error(
          'Error al obtener la deuda del cliente:',
          clientUpdateError
        );
        return;
      }

      const currentClientDebt = clientData.debt || 0;
      const updatedDebt =
        currentClientDebt + parseFloat(insertedOrder.total as string);
      const newClientStatus = updatedDebt > 0 ? 'overdue' : 'upToDate';

      const { error: updateClientError } = await this.supabase
        .from('clients')
        .update({ debt: updatedDebt, status: newClientStatus })
        .eq('id_client', insertedOrder.id_client);

      if (updateClientError) {
        console.error(
          'Error al actualizar la deuda del cliente:',
          updateClientError
        );
        return;
      }

      await this.getOrders();
      this.createNotification(insertedOrder);
      this.toggleAddOrderForm();
    }
  }

  // Función para calcular el subtotal dinámicamente
  getCalculatedSubtotal(order: Orders): number {
    if (!order) return 0;

    if (typeof order.base_total === 'number' && !isNaN(order.base_total)) {
      return order.base_total;
    }

    // Si el subtotal ya está guardado correctamente (no es 0), úsalo
    const storedSubtotal = parseFloat(order.subtotal as string) || 0;
    if (!isNaN(storedSubtotal) && storedSubtotal > 0) {
      return storedSubtotal;
    }

    // Si el subtotal es 0, calcularlo: Total - Cargos Extras
    const total = parseFloat(order.total as string) || 0;
    const extras =
      order.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
    const base = total - extras;

    return base;
  }

  extraChargeDescription: string = '';
  extraChargeAmount: number = 0;

  addExtraCharge(): void {
    if (this.extraChargeDescription && this.extraChargeAmount > 0) {
      if (!this.newOrder.extra_charges) {
        this.newOrder.extra_charges = [];
      }

      // Calcular el subtotal ANTES de agregar el cargo (si aún no existe)
      if (!this.newOrder.base_total == null) {
        const currentTotal = parseFloat(this.newOrder.total as string) || 0;
        this.newOrder.base_total = currentTotal;
        this.newOrder.subtotal = currentTotal.toString();
      }

      this.newOrder.extra_charges.push({
        description: this.extraChargeDescription,
        amount: this.extraChargeAmount,
      });

      this.extraChargeDescription = '';
      this.extraChargeAmount = 0;

      // Recalcular total con el nuevo cargo
      this.updateOrderTotalWithExtras();
    }
  }

  removeExtraCharge(index: number): void {
    this.newOrder.extra_charges?.splice(index, 1);
    this.updateOrderTotalWithExtras();
  }

  updateOrderTotalWithExtras(): void {
    let base =
      typeof this.newOrder.base_total === 'number' &&
      !isNaN(this.newOrder.base_total)
        ? this.newOrder.base_total
        : parseFloat(this.newOrder.subtotal as string) || 0;

    // Si aún no hay base (pedido viejo sin campos): derivar una sola vez
    const extras =
      this.newOrder.extra_charges?.reduce(
        (sum, c) => sum + (c.amount || 0),
        0
      ) || 0;
    if (!base) {
      const maybeTotal = parseFloat(this.newOrder.total as string) || 0;
      base = maybeTotal - extras;
      this.newOrder.base_total = base; // normaliza para futuras veces
    }

    // 2) Recalcular siempre desde la base
    this.newOrder.subtotal = base.toString();
    this.newOrder.total = (base + extras).toString();
    this.newOrder.amount = base + extras;
  }

  async createNotification(addedOrder: Partial<Orders>) {
    this.notificationDesc =
      'Nuevo pedido: ' +
      addedOrder.description +
      '. Codigo: ' +
      addedOrder.code;
    if (addedOrder.order_type == 'print') {
      this.notificationToInsert = {
        id_user: null,
        id_order: addedOrder.id_order,
        description: this.notificationDesc,
        type: 'prints',
        due_date: addedOrder.created_at,
      };
      const { error } = await this.supabase
        .from('notifications')
        .insert([this.notificationToInsert]);
      if (error) {
        console.error('Error creating notification', error);
        return;
      }
    } else if (addedOrder.order_type == 'laser') {
      this.notificationToInsert = {
        id_user: null,
        id_order: addedOrder.id_order,
        description: this.notificationDesc,
        type: 'cuts',
        due_date: addedOrder.created_at,
      };

      const { error } = await this.supabase
        .from('notifications')
        .insert([this.notificationToInsert]);
      if (error) {
        console.error('Error creating notification', error);
        return;
      }
    }
  }

  private formatDateForInput(date: Date | string): string {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  paginateItems<T>(items: T[], page: number, itemsPerPage: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }

  updatePaginatedOrder(): void {
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredOrdersList.length / this.itemsPerPage)
    );
    this.currentPage = Math.min(Math.max(this.currentPage, 1), this.totalPages);
    const startIndex = Number((this.currentPage - 1) * this.itemsPerPage);
    const endIndex = startIndex + Number(this.itemsPerPage);
    this.paginatedOrders = this.filteredOrdersList.slice(startIndex, endIndex);
  }

  openCalculator(): void {
    this.showCalculator = true;
    this.calculationType = null;
    this.resetForm();
  }

  closeCalculator(): void {
    this.showCalculator = false;
    this.resetForm();
  }

  resetForm(): void {
    this.calculatorResult = 0;
    this.clientType = null;
    this.lamination = false;
    this.pPrint = false;
    this.stamping = false;
    this.assemble = false;
    this.rollWidth = 0;
    this.measurement = 0;
    this.productNumber = 1;
    this.materialValue = 0;
    this.usageTime = 0;
  }

  setValoresPorCliente(): void {
    if (this.clientType === 'intermediary') {
      this.laminationValue = 1.2;
      this.printValue = 2;
      this.stampingValue = 1.2;
      this.assembleValue = 1.2;
    } else if (this.clientType === 'final') {
      this.laminationValue = 1.5;
      this.printValue = 5;
      this.stampingValue = 1.5;
      this.assembleValue = 1.5;
    }
  }

  calculatePrice(): void {
    if (this.calculationType == 'prints') {
      const base = this.rollWidth * this.measurement * this.productNumber;

      let factor = 0;

      if (this.lamination) factor += this.laminationValue;
      if (this.pPrint) factor += this.printValue;
      if (this.stamping) factor += this.stampingValue;
      if (this.assemble) factor += this.assembleValue;

      this.calculatorResult = base * factor;
    } else if (this.calculationType == 'cuts') {
      let valorTiempo = 0;
      if (this.usageTime <= 10) {
        valorTiempo = 8000;
      } else {
        valorTiempo =
          this.clientType === 'intermediary'
            ? this.usageTime * this.intermediaryPerMinute
            : this.usageTime * this.finalPerMinute;
      }

      this.calculatorResult = this.materialValue + valorTiempo;
    }
  }

  public getRemainingDeliveryDays(order: Orders): number {
    if (!order.delivery_date) return 0;

    const now = new Date();
    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(23, 59, 59, 999);

    const diffTime = deliveryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public getRemainingDeliveryHours(order: Orders): number {
    if (!order.delivery_date) return 0;

    const now = new Date();
    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(23, 59, 59, 999);

    const diffTime = deliveryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60));
  }

  public getFormattedDeliveryTime(order: Orders): string {
    const days = this.getRemainingDeliveryDays(order);
    const hours = this.getRemainingDeliveryHours(order);

    if (days <= 0 && hours <= 0) return 'Vencido';
    if (days === 1) return `${hours}h restantes`;
    return `${days} días`;
  }

  public isDeliveryOverdue(order: Orders): boolean {
    const days = this.getRemainingDeliveryDays(order);
    const hours = this.getRemainingDeliveryHours(order);
    return days <= 0 && hours <= 0;
  }

  public isDeliveryLastDay(order: Orders): boolean {
    const days = this.getRemainingDeliveryDays(order);
    const hours = this.getRemainingDeliveryHours(order);
    return days === 1 && hours > 0;
  }

  public hasMultipleDeliveryDays(order: Orders): boolean {
    return this.getRemainingDeliveryDays(order) > 1;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  async uploadOrderFile(orderId: string, filePath: string, file: File) {
    if (!this.selectedFile || !orderId) return;

    await this.supabase.uploadFile(filePath, file, 'order-files');

    this.uploadedFileName = file.name;
    this.selectedFile = null;
  }

  async downloadFile(filePath: string) {
    const { data, error } = await this.supabase.downloadFile(
      filePath,
      'order-files'
    );
    if (error) {
      console.error('error downloading image: ', error);
      return;
    }
    const response = await fetch(data.signedUrl);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filePath.split('/').pop() || 'archivo';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(blobUrl);
  }

  closeStockModal() {
    this.showStockWarningModal = false;
  }

  async showStockError(message: string): Promise<void> {
    this.stockWarningMessage = message;
    this.showStockWarningModal = true;

    return new Promise((resolve) => {
      this.closeStockModal = () => {
        this.showStockWarningModal = false;
        resolve();
      };
    });
  }

  async completeStockForOrder(order: Orders): Promise<void> {
    if (!order.pending_quantity || order.pending_quantity === 0) {
      alert('No hay cantidades pendientes para este pedido.');
      return;
    }

    // Determinar qué tabla usar según el tipo de pedido
    let detailTable: 'prints' | 'cuts' | 'sales' = 'prints';

    if (order.order_type === 'print') {
      detailTable = 'prints';
    } else if (order.order_type === 'laser') {
      detailTable = 'cuts';
    } else if (order.order_type === 'sales') {
      alert('Para ventas, usa el proceso normal de completar ítems.');
      return;
    } else {
      alert('Tipo de pedido no soportado.');
      return;
    }

    try {
      // 1. Obtener el detalle del pedido
      const { data: details, error: detailError } = await this.supabase
        .from(detailTable)
        .select('*')
        .eq('id_order', order.id_order)
        .single();

      if (detailError || !details) {
        console.error('Error obteniendo detalles:', detailError);
        alert('No se pudo obtener la información del pedido.');
        return;
      }

      const pendingQty = Number(details.pending_quantity || 0);
      const fulfilledQty = Number(details.fulfilled_quantity || 0);

      if (pendingQty === 0) {
        alert('No hay cantidades pendientes.');
        return;
      }

      // 2. Buscar el material correspondiente
      const material = this.allMaterials.find(m =>
        m.category === details.category &&
        m.type === details.material_type &&
        m.caliber === details.caliber &&
        m.color === details.color
      );

      if (!material) {
        alert('Material no encontrado en el inventario.');
        return;
      }

      const currentStock = parseFloat(material.material_quantity);

      // 3. Verificar si hay suficiente stock
      if (currentStock < pendingQty) {
        const confirmPartial = confirm(
          `Stock insuficiente.\n\n` +
          `Disponible: ${currentStock}\n` +
          `Necesario: ${pendingQty}\n\n` +
          `¿Desea completar parcialmente con ${currentStock} unidades?`
        );

        if (!confirmPartial) {
          return;
        }

        // Completar parcialmente
        const newStock = 0; // Se agota el stock disponible
        const newFulfilledQty = fulfilledQty + currentStock;
        const newPendingQty = pendingQty - currentStock;

        // Actualizar material
        await this.supabase
          .from('materials')
          .update({ material_quantity: newStock.toString() })
          .eq('id_material', material.id_material);

        // Actualizar detalle (prints/cuts)
        await this.supabase
          .from(detailTable)
          .update({
            fulfilled_quantity: newFulfilledQty,
            pending_quantity: newPendingQty
          })
          .eq('id_order', order.id_order);

        // Actualizar orden (sigue parcialmente completado)
        await this.supabase
          .from('orders')
          .update({
            stock_status: 'partially_fulfilled',
            pending_quantity: newPendingQty
          })
          .eq('id_order', order.id_order);

        alert(`Se completaron ${currentStock} unidades. Aún faltan ${newPendingQty}.`);
        await this.getOrders();
        return;
      }

      // 4. Hay suficiente stock - completar totalmente
      const confirmComplete = confirm(
        `¿Completar el pedido?\n\n` +
        `Se descontarán ${pendingQty} unidades del inventario.`
      );

      if (!confirmComplete) {
        return;
      }

      const newStock = currentStock - pendingQty;

      // Actualizar material
      await this.supabase
        .from('materials')
        .update({ material_quantity: newStock.toString() })
        .eq('id_material', material.id_material);

      // Actualizar detalle (prints/cuts)
      await this.supabase
        .from(detailTable)
        .update({
          fulfilled_quantity: fulfilledQty + pendingQty,
          pending_quantity: 0
        })
        .eq('id_order', order.id_order);

      // Actualizar orden (completado)
      await this.supabase
        .from('orders')
        .update({
          stock_status: 'fulfilled',
          pending_quantity: 0
        })
        .eq('id_order', order.id_order);

      alert('✅ Pedido completado correctamente.');
      await this.getOrders();

    } catch (error) {
      console.error('Error completando stock:', error);
      alert('Ocurrió un error al completar el stock.');
    }
  }

  clearFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.searchByNameQuery = '';
    this.showPrints = true;
    this.showCuts = true;
    this.showSales = true;
    this.searchQuery = '';
    this.selectedScheduler = '';
    this.updateFilteredOrders();
  }
  private async handleFileUploadForOrder(orderId: string): Promise<void> {
    if (!this.selectedFile) return;

    const file = this.selectedFile;
    const filePath = `order-files/${orderId}/${Date.now()}_${file.name}`;

    await this.uploadOrderFile(orderId, filePath, file);

    const { error: updatePathError } = await this.supabase
      .from('orders')
      .update({ file_path: filePath })
      .eq('id_order', orderId);

    if (updatePathError) {
      console.error(
        'Error al actualizar file_path del pedido:',
        updatePathError
      );
    }

    this.newOrder.file_path = filePath;
    this.selectedFile = null;
    this.uploadedFileName = null;
  }
}
