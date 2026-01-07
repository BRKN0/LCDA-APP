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
  created_time?: string;
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
  invoice_file: string;
  scheduler: string;
  cutting_time?: number;
  extra_charges?: {
    description: string;
    amount: number;
    type?: 'fixed' | 'percentage';
  }[];
  base_total?: number;
  stock_status?: 'fulfilled' | 'pending_stock' | 'partially_fulfilled';
  pending_quantity?: number;
  discount?: number;
  discount_type?: 'percentage' | 'fixed';
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
  unit_price?: number;
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
  due_date: string;
}

interface Variables {
  id: string;
  name: string;
  category: string;
  value: number;
  label: string;
}
interface VariableMap {
  iva: number;
  utility_margin: number;
  retefuente_bienes_declara: number;
  retefuente_bienes_no_declara: number;
  retefuente_servicios_declara: number;
  retefuente_servicios_no_declara: number;
  reteica_bienes: number;
  reteica_servicios: number;
  finalLaminationValue: number;
  finalPrintValue: number;
  finalStampingValue: number;
  finalAssembleValue: number;
  intermediaryLaminationValue: number;
  intermediaryPrintValue: number;
  intermediaryStampingValue: number;
  intermediaryAssembleValue: number;
  finalPerMinute: number;
  baseCutTimeValue: number;
  intermediaryPerMinute: number;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, MainBannerComponent, FormsModule, RouterOutlet],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
})
export class OrdersComponent implements OnInit {
  variables: VariableMap = {
    iva: 0,
    utility_margin: 0,
    retefuente_bienes_declara: 0,
    retefuente_bienes_no_declara: 0,
    retefuente_servicios_declara: 0,
    retefuente_servicios_no_declara: 0,
    reteica_bienes: 0,
    reteica_servicios: 0,
    finalLaminationValue: 0,
    finalPrintValue: 0,
    finalStampingValue: 0,
    finalAssembleValue: 0,
    intermediaryAssembleValue: 0,
    intermediaryLaminationValue: 0,
    intermediaryPrintValue: 0,
    intermediaryStampingValue: 0,
    baseCutTimeValue: 0,
    finalPerMinute: 0,
    intermediaryPerMinute: 0,
  };
  variablesMap: Record<string, number> = {};
  originalMap: Record<string, number> = {};
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
  //showCalculator: boolean = false;
  //calculationType: 'prints' | 'cuts' | 'sales' | null = null;
  //clientType: 'intermediary' | 'final' | null = null;
  //lamination: boolean = false;
  //pPrint: boolean = false;
  //stamping: boolean = false;
  //assemble: boolean = false;
  //laminationValue: number = 2;
  //printValue: number = 1.2;
  //stampingValue: number = 1.2;
  //assembleValue: number = 1.2;
  //rollWidth: number = 0;
  //measurement: number = 0;
  //productNumber: number = 1;
  //materialValue: number = 0;
  //intermediaryPerMinute: number = 800;
  //finalPerMinute: number = 1000;
  //usageTime: number = 0;
  //calculatorResult: number = 0;
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
  selectedInvoiceFile: File | null = null;
  showStockWarningModal = false;
  stockWarningMessage = '';
  selectedScheduler: string = '';
  /* Variables para ventas (sales)
  saleMode: 'none' | 'material' | 'product' = 'none';
  saleMaterialQuantity: number = 1;
  saleMaterialUnitPrice: number = 0;
  allProducts: any[] = [];
  selectedProductId: string = '';
  salesItems: any[] = [];
  isSaleModeLocked: boolean = false;
  */
  extraChargeDescription: string = '';
  extraChargeAmount: number = 0;
  extraChargeType: 'fixed' | 'percentage' = 'fixed';
  /*
  discount: number = 0;
  discountType: 'fixed' | 'percentage' = 'fixed';
  hasDiscountApplied: boolean = false;
  totalBeforeDiscount: number = 0;
  */
  /*
  // Array para almacenar múltiples materiales en prints
  printsItems: any[] = [];
  isPrintsModeLocked: boolean = false;

  // Variables temporales para cada material de prints
  tempPrintQuantity: number = 1;
  tempPrintLaminating: boolean = false;
  tempPrintDieCutting: boolean = false;
  tempPrintAssembly: boolean = false;
  tempPrintPrinting: boolean = false;
  tempPrintUnitaryValue: number = 0;
  tempPrintRollWidth: number = 0;
  tempPrintMeasurement: number = 0;
  */
  /*
  cutsItems: any[] = [];
  isCutsModeLocked: boolean = false;
  tempCutQuantity: number = 1;
  tempCutHeight: number = 0;
  tempCutWidth: number = 0;
  tempCutNotes: string = '';
  tempCutUnitaryValue: number = 0;
  */
  tempCutTime: number = 0;

  newClient = {
    name: '',
    email: '',
    document_type: '',
    document_number: '0',
    //company_name: '',
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
          //this.getProducts();
          this.getVariables();
        });
      } else {
        console.error('Usuario no autenticado.');
        this.orders = [];
        this.filteredOrdersList = [];
      }
    });
  }
  async getVariables() {
    this.loading = true;
    const { data } = await this.supabase.from('variables').select('name,value');
    if (data) {
      for (const v of data) {
        if (v.name in this.variables) {
          this.variables[v.name as keyof VariableMap] = parseFloat(v.value);
        }
      }
    }
    this.loading = false;
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

  /*
  async getProducts(): Promise<void> {
    const { data, error } = await this.supabase
      .from('products')
      .select('id, name, stock, price, code, category');

    if (error) {
      console.error('Error al cargar productos:', error);
      return;
    }
    this.allProducts = data || [];
  }¨
  */

  private getCurrentTimeHHMM(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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
      //company_name: '',
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

    const clientToSave = {
      ...this.newClient,
      name: this.newClient.name.toUpperCase().trim(),
    };

    //
    const { data, error } = await this.supabase
      .from('clients')
      .insert([clientToSave]);

    if (error) {
      console.error('Error añadiendo el cliente:', error);
      alert('Error al añadir el cliente.');
      return;
    }

    alert('Cliente añadido correctamente.');
    this.closeAddClientModal();
    await this.getClients();
  }

  /* Venta (sales)
  isSale(): boolean {
    const t = this.newOrder?.order_type;
    return t === 'sales';
  }
    */

  /* Builds the row for `sales` (sales-material)
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
  /*

  private isSaleActive(): boolean {
    return (
      this.newOrder?.order_type === 'sales' &&
      (this.saleMode === 'material' || this.saleMode === 'product')
    );
  }

  /*
  recalcSalesTotal(): void {
    if (!this.isSaleActive()) return;
    const q = Number(this.saleMaterialQuantity) || 0;
    const u = Number(this.saleMaterialUnitPrice) || 0;
    this.newOrder.base_total = q * u;
    this.updateOrderTotalWithExtras();
  }
  */

  /* Producto
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
  */

  /*
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
  */

  /*
  getProductNameById(productId: string | null | undefined): string {
    if (!productId) return '';
    const product = this.allProducts?.find((p) => p.id === productId);
    return product ? product.name : '';
  }
  /*

  asNumber(v: any): number {
    return typeof v === 'number' ? v : Number(v || 0);
  }

  /*
  addSaleItem(): void {
    if (this.saleMode === 'none') {
      alert('Seleccione si va a vender material o producto.');
      return;
    }

    // bloqueo del modo después del primer ítem
    if (!this.isSaleModeLocked && this.salesItems.length >= 1) {
      this.isSaleModeLocked = true;
    }

    // MATERIAL
    if (this.saleMode === 'material') {
      const m = this.getSelectedMaterial();
      if (!m) {
        alert('Seleccione un material completo.');
        return;
      }

      const qty = Number(this.saleMaterialQuantity);
      const price = Number(this.saleMaterialUnitPrice);

      if (qty <= 0 || price <= 0) {
        alert('Cantidad y precio deben ser mayores a cero.');
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

    // PRODUCTO
    if (this.saleMode === 'product') {
      const p = this.allProducts.find((x) => x.id === this.selectedProductId);
      if (!p) {
        alert('Seleccione un producto.');
        return;
      }

      const qty = Number(this.saleMaterialQuantity);
      const price = Number(this.saleMaterialUnitPrice);

      if (qty <= 0 || price <= 0) {
        alert('Cantidad y precio deben ser mayores a cero.');
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
  */

  /*
  removeSaleItem(index: number): void {
    this.salesItems.splice(index, 1);

    if (this.salesItems.length === 0) {
      this.isSaleModeLocked = false;
    }

    this.recalcSalesFromItems();
  }
  */

  /*
  recalcSalesFromItems(): void {
    let total = 0;
    for (const item of this.salesItems) {
      total += item.subtotal;
    }

    this.newOrder.base_total = total;
    this.updateOrderTotalWithExtras();
  }
    */

  /*
  validateSalesStock(): boolean {
    for (const item of this.salesItems) {
      const available = parseFloat(
        item.material?.material_quantity ?? item.product?.stock ?? 0
      );
      if (available < item.quantity) {
        // Mostrar error al usuario
        this.showStockError(
          `No hay suficiente stock. Disponible: ${available}`
        );
        return false;
      }
    }
    return true;
  }
  */


  /*
  async saveSaleItemsToSupabase(orderId: string): Promise<boolean> {
    let hasStockIssues = false;
    let totalPendingQty = 0;

    for (const item of this.salesItems) {
      // MATERIAL
      if (item.mode === 'material') {
        const m = item.material;

        const { data: matData, error: matErr } = await this.supabase
          .from('materials')
          .select('material_quantity')
          .eq('id_material', m.id_material)
          .single();

        if (matErr || !matData) {
          alert('No se pudo leer stock del material.');
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
          totalPendingQty += requestedQty - currentStock;
        }

        // Actualizar stock (nunca negativo)
        const newQty = Math.max(currentStock - deductedQty, 0);

        const { error: updateErr } = await this.supabase
          .from('materials')
          .update({ material_quantity: newQty.toString() })
          .eq('id_material', m.id_material);

        if (updateErr) {
          console.error('Error actualizando stock:', updateErr);
          return false;
        }

        // Insertar en sales
        const row = {
          id_order: orderId,
          item_type: 'material',
          material_id: m.id_material,
          product_id: null,
          quantity: item.quantity,
          fulfilled_quantity: deductedQty,
          pending_quantity: requestedQty - deductedQty,
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
          console.error('Error insertando línea de material:', insErr);
          return false;
        }
      }

      // PRODUCTO
      if (item.mode === 'product') {
        const p = item.product;

        const { data: prodData, error: prodErr } = await this.supabase
          .from('products')
          .select('stock')
          .eq('id', p.id)
          .single();

        if (prodErr || !prodData) {
          alert('No se pudo leer stock del producto.');
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
          totalPendingQty += requestedQty - currentStock;
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
          fulfilled_quantity: deductedQty,
          pending_quantity: requestedQty - deductedQty,
          unit_price: item.unit_price,
          line_total: item.subtotal,
        };

        const { error: insErr } = await this.supabase
          .from('sales')
          .insert([row]);

        if (insErr) {
          console.error('Error insertando línea de producto:', insErr);
          return false;
        }
      }
    }

    // Actualizar el estado de stock del pedido
    const stockStatus = hasStockIssues
      ? totalPendingQty ===
        this.salesItems.reduce((sum, i) => sum + i.quantity, 0)
        ? 'pending_stock'
        : 'partially_fulfilled'
      : 'fulfilled';

    await this.supabase
      .from('orders')
      .update({
        stock_status: stockStatus,
        pending_quantity: totalPendingQty,
      })
      .eq('id_order', orderId);

    // Mostrar advertencia si hay problemas de stock
    if (hasStockIssues) {
      alert(
        ` ADVERTENCIA: El pedido fue creado pero hay ${totalPendingQty} unidades pendientes por falta de stock.`
      );
    }

    return true;
  }
  */

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
        order.order_completion_status === 'finished' ? 'inProgress' : 'finished';
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
        created_time: this.getCurrentTimeHHMM(),
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
        order_completion_status: 'inProgress',
        order_delivery_status: 'toBeDelivered',
        notes: '',
        file_path: '',
        invoice_file: '',
        scheduler: '',
        discount: 0,
        discount_type: 'fixed',
      };
      /*
      this.salesItems = [];
      this.saleMode = 'none';
      this.saleMaterialQuantity = 1;
      this.saleMaterialUnitPrice = 0;¨
      */
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';
      /*
      this.isSaleModeLocked = false;
      this.discount = 0;
      this.discountType = 'fixed';
      */
      /*
      this.extraChargeType = 'fixed';¨
      this.hasDiscountApplied = false;
      this.totalBeforeDiscount = 0;
      this.printsItems = [];
      this.isSaleModeLocked = false;
      this.isPrintsModeLocked = false;
      this.cutsItems = [];
      this.tempCutQuantity = 1;
      this.tempCutHeight = 0;
      this.tempCutWidth = 0;
      */
      this.tempCutTime = 0;
      /*
      this.tempCutUnitaryValue = 0;¨
      */
    }
    this.showModal = !this.showModal;
    if (!this.showModal) {
      this.getOrders();
    }
  }

  /*
  async editOrder(order: Orders): Promise<void> {
    this.isEditing = true;
    this.showModal = true;

    await this.getMaterials();

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

    // PRINTS
    if (order.order_type === 'print') {
      // === 1. Traer TODAS las líneas de prints ===
      const { data: rows, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order);

      if (error) {
        console.error('editOrder: Error cargando prints', error);
        return;
      }

      // === 2. Resetear printsItems ===
      this.printsItems = [];

      if (!rows || rows.length === 0) {
        // No tiene líneas → pedido sin materiales
        return;
      }

      // === 3. Insertar todas las líneas en printsItems[] ===
      for (const r of rows) {
        // Buscar el material completo en allMaterials
        const material = this.allMaterials.find(
          (m: any) =>
            m.category === r.category &&
            m.type === r.material_type &&
            (m.caliber || '') === (r.caliber || '') &&
            (m.color || '') === (r.color || '')
        );

        if (material) {
          // Calcular procesos en string
          const processes: string[] = [];
          if (r.laminating) processes.push('Laminado');
          if (r.printing) processes.push('Impresión');
          if (r.die_cutting) processes.push('Troquelado');
          if (r.assembly) processes.push('Armado');
          const processesStr = processes.join(', ') || '-';

          // Calcular cantidad y subtotal
          const quantity = Number(r.quantity);

          // Usar el unit_price guardado en la BD (si existe)
          const processedValue = Number(r.unit_price) || 0;
          const subtotal = quantity * processedValue;

          // Push al array
          this.printsItems.push({
            material: material,
            quantity: quantity,
            laminating: r.laminating || false,
            die_cutting: r.die_cutting || false,
            assembly: r.assembly || false,
            printing: r.printing || false,
            unitary_value: Number(material.unitary_value) || 0,
            processed_unit_value: processedValue,
            subtotal: subtotal,
            roll_width: Number(r.roll_width) || 0,
            measurement: Number(r.measurement) || 0,
            processes: processesStr,
          });
        }
      }

      // === 4. Limpiar selects para agregar nuevos ítems ===
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';
      this.tempPrintQuantity = 1;
      this.tempPrintUnitaryValue = 0;
      this.tempPrintLaminating = false;
      this.tempPrintDieCutting = false;
      this.tempPrintAssembly = false;
      this.tempPrintPrinting = false;
      this.tempPrintRollWidth = 0;
      this.tempPrintMeasurement = 0;
    }

    // LASER CUTS
    else if (order.order_type === 'laser') {
      // 1. Traer TODAS las líneas de cuts
      const { data: rows, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order);

      if (error) {
        console.error('editOrder: Error cargando cuts:', error);
        return;
      }

      // 2. Resetear cutsItems
      this.cutsItems = [];

      if (!rows || rows.length === 0) {
        console.log('No hay líneas de cuts para este pedido');
        return;
      }

      // 3. Insertar todas las líneas en cutsItems
      for (const r of rows) {
        let material = this.allMaterials.find(
          (m: any) =>
            m.category?.toString().toLowerCase().trim() ===
              r.category?.toString().toLowerCase().trim() &&
            m.type?.toString().toLowerCase().trim() ===
              r.material_type?.toString().toLowerCase().trim() &&
            m.caliber?.toString().toLowerCase().trim() ===
              r.caliber?.toString().toLowerCase().trim() &&
            m.color?.toString().toLowerCase().trim() ===
              r.color?.toString().toLowerCase().trim()
        );

        // FALLBACK: Si no se encuentra, crear objeto con datos guardados
        if (!material) {
          material = {
            category: r.category,
            type: r.material_type,
            caliber: r.caliber,
            color: r.color,
            unitaryvalue: r.unit_price || 0,
            idmaterial: null,
          };
        }

        const quantity = Number(r.quantity);
        const unitPrice = Number(r.unit_price || 0);
        const cutTime = Number(r.cutting_time || 0);

        // Calcular el costo del corte
        const cutCost = this.calculateCutCost(cutTime);

        // Total = (precio unitario × cantidad) + costo de corte
        const subtotal = unitPrice * quantity + cutCost;

        // Push al array
        this.cutsItems.push({
          material: material,
          quantity: quantity,
          height: Number(r.height || 0),
          width: Number(r.width || 0),
          cutTime: cutTime,
          unitPrice: unitPrice,
          processedValue: cutCost,
          subtotal: subtotal,
        });
      }

      // 4. Limpiar selects
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';
      this.tempCutQuantity = 1;
      this.tempCutHeight = 0;
      this.tempCutWidth = 0;
      this.tempCutTime = 0;
      this.tempCutUnitaryValue = 0;
    }

    // SALES
    else if (this.newOrder.order_type === 'sales') {
      // 1. Traer TODAS las líneas de ventas
      const { data: rows, error } = await this.supabase
        .from('sales')
        .select(
          'item_type, product_id, material_id, quantity, unit_price, line_total, material_type, caliber, color, category'
        )
        .eq('id_order', order.id_order);

      if (error) {
        console.error('editOrder: Error cargando ventas', error);
        return;
      }

      // 2. Resetear salesItems
      this.salesItems = [];

      if (!rows || rows.length === 0) {
        // No tiene líneas (pedido raro o cotización antigua)
        this.saleMode = 'none';
        this.isSaleModeLocked = false;
        return;
      }

      // 3. Insertar todas las líneas en salesItems
      for (const r of rows) {
        if (r.item_type === 'material') {
          this.salesItems.push({
            mode: 'material',
            material: {
              id_material: r.material_id,
              category: r.category,
              type: r.material_type,
              caliber: r.caliber,
              color: r.color,
            },
            quantity: Number(r.quantity),
            unit_price: Number(r.unit_price),
            subtotal: Number(r.line_total),
          });
        }
        if (r.item_type === 'product') {
          const prod = this.allProducts.find((p: any) => p.id === r.product_id);
          this.salesItems.push({
            mode: 'product',
            product: prod
              ? prod
              : { id: r.product_id, name: 'Producto eliminado' },
            quantity: Number(r.quantity),
            unit_price: Number(r.unit_price),
            subtotal: Number(r.line_total),
          });
        }
      }

      // 4. Configurar el modo de venta según la primera línea
      const first = this.salesItems[0];
      this.saleMode = first.mode;
      this.isSaleModeLocked = true;

      // 5. Limpiar selects para agregar nuevos ítems
      this.selectedProductId = '';
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';
      this.saleMaterialQuantity = 1;
      this.saleMaterialUnitPrice = 0;

      // 6. Recalcular totales
      this.recalcSalesFromItems();
    }

    // DESCUENTO
    if (this.newOrder.discount && Number(this.newOrder.discount) > 0) {
      this.hasDiscountApplied = true;

      // Guardar el descuento en las variables del componente
      this.discount = Number(this.newOrder.discount);
      this.discountType = this.newOrder.discount_type || 'fixed';

      // Calcular el total SIN descuento (base + extras)
      const base = Number(this.newOrder.base_total) || 0;
      const extras =
        this.newOrder.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
      this.totalBeforeDiscount = base + extras;
    } else {
      this.hasDiscountApplied = false;
      this.totalBeforeDiscount = 0;
      this.discount = 0;
      this.discountType = 'fixed';
    }
  }
  */

  async editOrder(order: Orders): Promise<void> {
    this.isEditing = true;
    this.showModal = true;
    await this.getMaterials();

    this.newOrder = { ...order };

    // Normalizar fecha (tu col es timestamp/date)
    this.newOrder.delivery_date = order.delivery_date
      ? order.delivery_date.slice(0, 10)
      : '';

     // CARGAR cutting_time en tempCutTime para pedidos tipo LASER
      if (order.order_type === 'laser') {
        this.tempCutTime = Number(order.cutting_time) || 0;
      } else {
        this.tempCutTime = 0; // Limpiar para otros tipos
      }

    // base_total calcula without breaking if extra_charges is not an array
    const extrasArray = Array.isArray(this.newOrder.extra_charges)
      ? this.newOrder.extra_charges
      : [];

    if (!this.newOrder.base_total || isNaN(Number(this.newOrder.base_total))) {
      if (this.newOrder.subtotal && !isNaN(Number(this.newOrder.subtotal))) {
        this.newOrder.base_total = Number(this.newOrder.subtotal);
      } else {
        const extrasSum = extrasArray.reduce(
          (sum: number, c: any) => sum + (Number(c?.amount) || 0),
          0
        );
        this.newOrder.base_total = Number(this.newOrder.total || 0) - extrasSum;
      }
    }

    // ====================================================================
    // NOTA IMPORTANTE: Ya no cargamos datos de prints, cuts ni sales
    // Solo mostramos la información global del pedido
    // ====================================================================

    // Para CUTS, el campo cutting_time ya está en newOrder desde la tabla orders
    // No es necesario hacer ninguna carga adicional

    // Limpiar los selectores para evitar confusión
    this.selectedCategory = '';
    this.selectedType = '';
    this.selectedCaliber = '';
    this.selectedColor = '';
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
      const confirmMessage = `El cliente ha excedido su límite de crédito por lo que su deuda actual aumentará en el caso de que el pedido sea autorizado.

      ¿Desea autorizar este pedido de todas formas?`;

      if (!confirm(confirmMessage)) {
        return;
      }
    }

    // Calcular el total base (valor ingresado manualmente)
    const baseTotal = parseFloat(newOrderForm.unitary_value as string) || 0;

    // Sumar cargos extras
    const extras = newOrderForm.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;

    // Total final = base + extras
    const total = baseTotal + extras;

    this.newOrder = {
      order_type: newOrderForm.order_type,
      name: newOrderForm.name,
      client_type: newOrderForm.client_type,
      description: newOrderForm.description,
      order_payment_status: newOrderForm.order_payment_status || 'overdue',
      created_at: new Date().toISOString(),
      created_time: this.getCurrentTimeHHMM(),
      delivery_date: newOrderForm.delivery_date,
      order_quantity: newOrderForm.order_quantity,
      unitary_value: baseTotal, // Valor total del pedido (ingresado manualmente)
      iva: newOrderForm.iva || 0,
      subtotal: baseTotal, // Subtotal = valor base
      total: total, // Total = base + extras
      amount: newOrderForm.amount || 0,
      cutting_time: newOrderForm.cutting_time || 0,
      id_client: newOrderForm.id_client,
      order_confirmed_status: newOrderForm.order_confirmed_status,
      order_completion_status: newOrderForm.order_completion_status,
      order_delivery_status: newOrderForm.order_delivery_status,
      notes: newOrderForm.notes,
      file_path: newOrderForm.file_path,
      invoice_file: newOrderForm.file_path,
      extra_charges: newOrderForm.extra_charges || [],
      base_total: baseTotal,
      scheduler: await this.getUserName() || 'Desconocido',
    };

    // Asignar tempCutTime para pedidos tipo LASER
    if (this.newOrder.order_type === 'laser') {
      this.newOrder.cutting_time = this.tempCutTime || 0;
}

    const deliveryDate = newOrderForm.delivery_date
      ? new Date(newOrderForm.delivery_date)
      : new Date();
    const paymentTerm = 30;
    const currentDate = new Date();
    const dueDate = new Date(currentDate);
    dueDate.setDate(dueDate.getDate() + paymentTerm);

    if (this.isEditing) {
      // ========================================
      // MODO EDICIÓN
      // ========================================
      if (!newOrderForm.id_order) {
        console.error('ID del pedido no definido para actualizar.');
        alert('Error: No se puede actualizar un pedido sin ID.');
        return;
      }

      this.newOrder.id_order = newOrderForm.id_order;

      // ACTUALIZAR cutting_time desde tempCutTime
      if (this.newOrder.order_type === 'laser') {
        this.newOrder.cutting_time = this.tempCutTime || 0;
      }

      // Subir archivo si existe
      await this.handleFileUploadForOrder(this.newOrder.id_order!);
      this.selectedFile = null;
      this.uploadedFileName = null;

      // Actualizar el pedido en la tabla orders
      const { error } = await this.supabase
        .from('orders')
        .update([this.newOrder])
        .eq('id_order', this.newOrder.id_order);

      if (error) {
        console.error('Error al actualizar el pedido:', error);
        alert('Error al actualizar el pedido.');
        return;
      }

      // NUEVO: Actualizar también en tabla cuts si es tipo laser
      if (this.newOrder.order_type === 'laser') {
        // Verificar si ya existe un registro en cuts
        const { data: existingCut } = await this.supabase
          .from('cuts')
          .select('id')
          .eq('id_order', this.newOrder.id_order)
          .maybeSingle();

        if (existingCut) {
          // Si existe, actualizar
          const { error: updateCutError } = await this.supabase
            .from('cuts')
            .update({
              cutting_time: this.tempCutTime,
              unit_price: Number(this.newOrder.unitary_value) || 0,
            })
            .eq('id_order', this.newOrder.id_order);

          if (updateCutError) {
            console.error('Error al actualizar tabla cuts:', updateCutError);
          } else {
            console.log('✅ Registro actualizado en tabla cuts');
          }
        } else {
          // Si no existe, insertar
          const cutRecord = {
            id_order: this.newOrder.id_order,
            category: 'Corte Laser',
            material_type: 'General',
            color: null,
            caliber: null,
            height: null,
            width: null,
            quantity: 1,
            cutting_time: this.tempCutTime,
            unit_price: Number(this.newOrder.unitary_value) || 0,
          };

          const { error: insertCutError } = await this.supabase
            .from('cuts')
            .insert([cutRecord]);

          if (insertCutError) {
            console.error('Error al insertar en tabla cuts:', insertCutError);
          } else {
            console.log('✅ Registro insertado en tabla cuts');
          }
        }
      }

      alert('Pedido actualizado correctamente.');
      this.showModal = false;
      await this.getOrders();

    } else {
      // ========================================
      // MODO CREACIÓN
      // ========================================

      // Obtener el código más alto
      const { data: maxCodeData, error: maxCodeError } = await this.supabase
        .from('orders')
        .select('code')
        .order('code', { ascending: false })
        .limit(1);

      if (maxCodeError) {
        console.error('Error al obtener el código máximo:', maxCodeError);
        alert('Error al generar el código del pedido.');
        return;
      }

      const maxCode = maxCodeData && maxCodeData.length > 0 ? maxCodeData[0].code : 0;
      this.newOrder.code = maxCode + 1;

      // Insertar el pedido
      const { data: insertedOrderData, error: insertError } = await this.supabase
        .from('orders')
        .insert([this.newOrder])
        .select();

      if (insertError || !insertedOrderData || insertedOrderData.length === 0) {
        console.error('Error al insertar el pedido:', insertError);
        alert('Error al crear el pedido.');
        return;
      }

      const insertedOrder = insertedOrderData[0];

      // Si es pedido tipo LASER, insertar registro en tabla cuts
      if (this.newOrder.order_type === 'laser' && this.tempCutTime > 0) {
        const cutRecord = {
          id_order: insertedOrder.id_order,
          category: 'Corte Laser',
          material_type: 'General',
          color: null,
          caliber: null,
          height: null,
          width: null,
          quantity: 1,
          cutting_time: this.tempCutTime,
          unit_price: Number(this.newOrder.unitary_value) || 0,
        };

        const { error: cutError } = await this.supabase
          .from('cuts')
          .insert([cutRecord]);

        if (cutError) {
          console.error('Error al insertar en tabla cuts:', cutError);
        } else {
          console.log('✅ Registro insertado correctamente en tabla cuts');
        }
      }

      // Subir archivo si existe
      await this.handleFileUploadForOrder(insertedOrder.id_order);
      this.selectedFile = null;
      this.uploadedFileName = null;

      // Actualizar la deuda del cliente
      const newClientDebt = currentDebt + orderAmount;
      const { error: updateDebtError } = await this.supabase
        .from('clients')
        .update({
          debt: newClientDebt,
          status: newClientDebt > 0 ? 'overdue' : 'upToDate',
        })
        .eq('id_client', newOrderForm.id_client);

      if (updateDebtError) {
        console.error('Error al actualizar la deuda del cliente:', updateDebtError);
      }

      // Crear notificación
      this.notificationToInsert = {
        type: 'order',
        description: `Nuevo pedido creado: ${this.newOrder.code}`,
        id_order: insertedOrder.id_order,
        due_date: this.newOrder.delivery_date,
        id_user: this.userId,
      };

      const { error: notificationError } = await this.supabase
        .from('notifications')
        .insert([this.notificationToInsert]);

      if (notificationError) {
        console.error('Error al crear la notificación:', notificationError);
      }

      // Crear factura
      const invoiceData = {
        id_order: insertedOrder.id_order,
        code: this.newOrder.code?.toString() || '',
        payment_term: paymentTerm,
        include_iva: false,
        due_date: dueDate.toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        invoice_status: 'overdue',
      };

      const { error: invoiceError } = await this.supabase
        .from('invoices')
        .insert([invoiceData]);

      if (invoiceError) {
        console.error('Error al crear la factura:', invoiceError);
      }

      alert('Pedido creado correctamente.');
      this.showModal = false;
      await this.getOrders();
    }
  }

  /*
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

    const extras =
      newOrderForm.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
    const discountAmount = this.hasDiscountApplied ? this.discount || 0 : 0;
    const total = parseFloat(newOrderForm.total as string) || 0;

    // Calcular base_total (sin extras, sin descuento)
    let base_total = 0;
    if (this.newOrder.base_total && !isNaN(Number(this.newOrder.base_total))) {
      // Si ya existe base_total, usarlo
      base_total = Number(this.newOrder.base_total);
    } else {
      // Si no existe, calcularlo desde el total
      // Fórmula: base_total = total - extras + descuento
      base_total = total - extras + discountAmount;
    }

    const subtotal = base_total; // El subtotal es igual al base_total

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
      base_total: base_total,
      discount: this.discount || 0,
      discount_type: this.discountType || 'fixed',
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

      // PRINTS (EDICIÓN)
      if (this.newOrder.order_type === 'print') {
        if (this.printsItems.length === 0) {
          alert(
            'Debe agregar al menos un material para el pedido de impresión.'
          );
          return;
        }

        const { error: deleteError } = await this.supabase
          .from('prints')
          .delete()
          .eq('id_order', this.newOrder.id_order);

        if (deleteError) {
          console.error('Error eliminando prints antiguos:', deleteError);
          alert('Error al eliminar materiales anteriores del pedido.');
          return;
        }

        for (const item of this.printsItems) {
          const selectedMaterial = item.material;

          const printData = {
            id_order: this.newOrder.id_order,
            material_type: selectedMaterial?.type || '',
            caliber: selectedMaterial?.caliber || '',
            color: selectedMaterial?.color || '',
            category: selectedMaterial?.category || '',
            laminating: item.laminating,
            die_cutting: item.die_cutting,
            assembly: item.assembly,
            printing: item.printing,
            product_number: '1',
            quantity: item.quantity.toString(),
            damaged_material: '0',
            notes: '',
            unit_price: item.processed_unit_value,
            roll_width: item.roll_width || 0,
            measurement: item.measurement || 0,
            fulfilled_quantity: 0,
            pending_quantity: item.quantity,
          };

          const { error: printInsertError } = await this.supabase
            .from('prints')
            .insert([printData]);

          if (printInsertError) {
            console.error('Error insertando impresión:', printInsertError);
            alert('Error al guardar los materiales del pedido.');
            return;
          }
        }

        // Recalcular el total del pedido
        this.recalcPrintsFromItems();

        alert('Pedido actualizado correctamente.');
      }
      // LASER (EDICIÓN)
      else if (this.newOrder.order_type === 'laser') {
        if (this.cutsItems.length === 0) {
          alert('Debe agregar al menos un material para el pedido de corte.');
          return;
        }

        const { error: deleteError } = await this.supabase
          .from('cuts')
          .delete()
          .eq('id_order', this.newOrder.id_order);

        if (deleteError) {
          console.error('Error eliminando cuts antiguos:', deleteError);
          alert('Error al eliminar materiales anteriores del pedido.');
          return;
        }

        // En modo edición, asumimos que el stock ya fue descontado previamente
        // Solo actualizamos las líneas de cuts con los datos actuales de cutsItems
        for (const item of this.cutsItems) {
          const selectedMaterial = item.material;

          // Insertar en cuts manteniendo fulfilled_quantity y pending_quantity
          const cutData = {
            id_order: this.newOrder.id_order,
            material_type: selectedMaterial?.type || '',
            caliber: selectedMaterial?.caliber || '',
            color: selectedMaterial?.color || '',
            category: selectedMaterial?.category || '',
            quantity: item.quantity.toString(),
            height: item.height.toString(),
            width: item.width.toString(),
            cutting_time: item.cutTime.toString(),
            fulfilled_quantity: item.quantity,
            pending_quantity: 0,
            unit_price: item.unitPrice,
            line_total: item.subtotal,
          };

          const { error: cutInsertError } = await this.supabase
            .from('cuts')
            .insert(cutData);

          if (cutInsertError) {
            console.error('Error insertando corte:', cutInsertError);
            alert('Error al guardar los materiales del pedido.');
            return;
          }
        }

        // Recalcular el total del pedido (solo precios, no stock)
        this.recalcCutsFromItems();

        alert('Pedido actualizado correctamente.');
      }
      // SALES (EDICIÓN)
      else if (this.newOrder.order_type === 'sales') {
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
        const rowsToInsert = this.salesItems.map((item) => {
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
              category: item.material.category,
            };
          } else {
            return {
              id_order: orderId,
              item_type: 'product',
              product_id: item.product.id,
              material_id: null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.subtotal,
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
    }
    // CREACIÓN (NUEVO PEDIDO)
    else {
      const userName = await this.getUserName();
      this.newOrder.scheduler = userName || '';

      // Hora exacta del agendamiento
      this.newOrder.created_time = this.getCurrentTimeHHMM();

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

      // PRINTS (CREACIÓN)
      if (this.newOrder.order_type === 'print' && this.printsItems.length > 0) {
        let hasStockIssues = false;
        let totalPendingQty = 0;

        for (const item of this.printsItems) {
          const selectedMaterial = item.material;

          // Leer stock actual
          const { data: matData, error: matErr } = await this.supabase
            .from('materials')
            .select('material_quantity')
            .eq('id_material', selectedMaterial.id_material)
            .single();

          if (matErr || !matData) {
            alert('No se pudo leer stock del material.');
            return;
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
            totalPendingQty += requestedQty - currentStock;
          }

          // Actualizar stock
          const newQty = Math.max(currentStock - deductedQty, 0);
          const { error: updateErr } = await this.supabase
            .from('materials')
            .update({ material_quantity: newQty.toString() })
            .eq('id_material', selectedMaterial.id_material);

          if (updateErr) {
            console.error('Error actualizando stock', updateErr);
            return;
          }

          // Insertar en prints
          const printRow = {
            id_order: this.newOrder.id_order,
            material_type: selectedMaterial.type,
            caliber: selectedMaterial.caliber || '',
            color: selectedMaterial.color || '',
            category: selectedMaterial.category,
            laminating: item.laminating,
            die_cutting: item.die_cutting,
            assembly: item.assembly,
            printing: item.printing,
            product_number: '1',
            quantity: requestedQty.toString(),
            fulfilled_quantity: deductedQty,
            pending_quantity: requestedQty - deductedQty,
            damaged_material: '0',
            notes: '',
            unit_price: item.processed_unit_value,
            roll_width: item.roll_width || 0,
            measurement: item.measurement || 0,
          };

          const { error: insErr } = await this.supabase
            .from('prints')
            .insert(printRow);

          if (insErr) {
            console.error('Error insertando print', insErr);
            return;
          }
        }

        // Actualizar stock status del pedido
        const stockStatus = hasStockIssues
          ? totalPendingQty >=
            this.printsItems.reduce((sum, i) => sum + i.quantity, 0)
            ? 'pending_stock'
            : 'partially_fulfilled'
          : 'fulfilled';

        await this.supabase
          .from('orders')
          .update({
            stock_status: stockStatus,
            pending_quantity: totalPendingQty,
          })
          .eq('id_order', this.newOrder.id_order);

        // Mostrar advertencia si hay problemas
        if (hasStockIssues) {
          alert(
            `⚠️ ADVERTENCIA: El pedido fue creado pero hay ${totalPendingQty} unidades pendientes por falta de stock.`
          );
        }
      }
      // GUARDAR CUTS (CORTES) - CREACIÓN
      else if (this.newOrder.order_type === 'laser') {
        if (this.cutsItems.length === 0) {
          alert('Debe agregar al menos un material para el pedido de corte.');
          return;
        }

        let hasStockIssues = false;
        let totalPendingQty = 0;

        // Insertar múltiples cuts
        for (const item of this.cutsItems) {
          const selectedMaterial = item.material;

          // Leer stock actual
          const { data: matData, error: matErr } = await this.supabase
            .from('materials')
            .select('material_quantity')
            .eq('id_material', selectedMaterial.id_material)
            .single();

          if (matErr || !matData) {
            alert('No se pudo leer stock del material.');
            return;
          }

          const currentStock = Number(matData.material_quantity);
          const quantityToUse = item.quantity;

          // Descontar solo lo que hay disponible
          let deductedQty = 0;
          let pendingQty = 0;

          if (currentStock >= quantityToUse) {
            deductedQty = quantityToUse;
            pendingQty = 0;
          } else {
            deductedQty = currentStock;
            pendingQty = quantityToUse - currentStock;
            hasStockIssues = true;
            totalPendingQty += pendingQty;
          }

          // Actualizar stock
          const finalStock = Math.max(currentStock - deductedQty, 0);
          await this.supabase
            .from('materials')
            .update({ material_quantity: finalStock.toString() })
            .eq('id_material', selectedMaterial.id_material);

          // Insertar en cuts
          const cutData = {
            id_order: this.newOrder.id_order,
            material_type: selectedMaterial?.type || '',
            caliber: selectedMaterial?.caliber || '',
            color: selectedMaterial?.color || '',
            category: selectedMaterial?.category || '',
            quantity: item.quantity.toString(),
            height: item.height.toString(),
            width: item.width.toString(),
            cutting_time: item.cutTime.toString(),
            fulfilled_quantity: deductedQty,
            pending_quantity: pendingQty,
            unit_price: item.unitPrice,
            line_total: item.subtotal,
          };

          const { error: cutInsertError } = await this.supabase
            .from('cuts')
            .insert(cutData);

          if (cutInsertError) {
            console.error('Error insertando corte:', cutInsertError);
            return;
          }
        }

        // Actualizar stock_status en orders
        const stockStatus = hasStockIssues
          ? totalPendingQty >=
            this.cutsItems.reduce((sum, i) => sum + i.quantity, 0)
            ? 'pending_stock'
            : 'partially_fulfilled'
          : 'fulfilled';

        await this.supabase
          .from('orders')
          .update({
            stock_status: stockStatus,
            pending_quantity: totalPendingQty,
          })
          .eq('id_order', this.newOrder.id_order);

        // Mostrar advertencia si hay problemas de stock
        if (hasStockIssues) {
          alert(
            `⚠️ ADVERTENCIA: El pedido fue creado pero hay ${totalPendingQty} unidades pendientes por falta de stock.\n\n` +
              `Podrás usar el botón "Completar Stock" cuando haya material disponible.`
          );
        }
      }

      // SALES (CREACIÓN)
      else if (this.newOrder.order_type === 'sales') {
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
  */

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

  addExtraCharge(): void {
    if (this.extraChargeDescription && this.extraChargeAmount > 0) {
      if (!this.newOrder.extra_charges) {
        this.newOrder.extra_charges = [];
      }

      // Asegurarse de tener base_total correcto
      if (!this.newOrder.base_total || this.newOrder.base_total === 0) {
        // Primero intentar obtener desde subtotal
        if (this.newOrder.subtotal && !isNaN(Number(this.newOrder.subtotal))) {
          this.newOrder.base_total = Number(this.newOrder.subtotal);
        }
        // Si no hay subtotal, calcular desde el total QUITANDO los extras existentes
        else {
          const currentTotal = parseFloat(this.newOrder.total as string) || 0;
          const existingExtras =
            this.newOrder.extra_charges?.reduce(
              (sum, c) => sum + c.amount,
              0
            ) || 0;

          // Fórmula: base_total = total - extras
          this.newOrder.base_total =
            currentTotal - existingExtras;
        }
      }

      // Calcular el monto del cargo según el tipo CON REDONDEO
      let chargeAmount = this.extraChargeAmount;

      if (this.extraChargeType === 'percentage') {
        const base = this.newOrder.base_total || 0;
        chargeAmount = Math.round((base * this.extraChargeAmount) / 100);
      } else {
        chargeAmount = Math.round(this.extraChargeAmount);
      }

      this.newOrder.extra_charges.push({
        description: this.extraChargeDescription,
        amount: chargeAmount,
        type: this.extraChargeType,
      });

      this.extraChargeDescription = '';
      this.extraChargeAmount = 0;
      this.extraChargeType = 'fixed';

      // Recalcular total con el nuevo cargo
      this.updateOrderTotalWithExtras();
    }
  }

  removeExtraCharge(index: number): void {
    this.newOrder.extra_charges?.splice(index, 1);
    this.updateOrderTotalWithExtras();
  }

  updateOrderTotalWithExtras(): void {
    const baseTotal = Number(this.newOrder.unitary_value) || 0;
    const extras = this.newOrder.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;

    this.newOrder.total = baseTotal + extras;
    this.newOrder.subtotal = baseTotal;
    this.newOrder.base_total = baseTotal;
  }

  /*
  updateOrderTotalWithExtras(): void {
    // 1. Obtener base (subtotal de materiales/items)
    let base =
      typeof this.newOrder.base_total === 'number' &&
      !isNaN(this.newOrder.base_total)
        ? this.newOrder.base_total
        : parseFloat(this.newOrder.subtotal as string) || 0;

    // Si aún no hay base, calcularla
    if (!base) {
      const maybeTotal = parseFloat(this.newOrder.total as string) || 0;
      const extras =
        this.newOrder.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
      base = maybeTotal - extras;
      this.newOrder.base_total = base;
    }

    // 2. Sumar cargos extras
    const extras =
      this.newOrder.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;

    // 3. Calcular total SIN descuento (base + extras)
    const totalWithoutDiscount = base + extras;

    // 4. Actualizar subtotal
    this.newOrder.subtotal = base.toString();

    // 5. Aplicar descuento si existe
    if (
      this.hasDiscountApplied &&
      this.newOrder.discount &&
      this.newOrder.discount > 0
    ) {
      let discountAmount = 0;

      if (this.newOrder.discount_type === 'percentage') {
        // Descuento porcentual sobre el total (base + extras)
        discountAmount = Math.round(
          (totalWithoutDiscount * this.newOrder.discount) / 100
        );
      } else {
        // Descuento fijo
        discountAmount = Math.round(this.newOrder.discount);
      }

      const finalTotal = Math.max(totalWithoutDiscount - discountAmount, 0);

      this.newOrder.total = finalTotal.toString();
      this.totalBeforeDiscount = totalWithoutDiscount;
    } else {
      // Sin descuento
      this.newOrder.total = totalWithoutDiscount.toString();
      this.totalBeforeDiscount = 0;
    }
  }
  */

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

  /* MÉTODOS PARA DESCUENTOS
  calculateDiscountAmount(): number {
    if (!this.discount || this.discount === 0) {
      return 0;
    }

    // Calcular base (subtotal + extras)
    const baseTotal = Number(this.newOrder.base_total || 0);
    const extras =
      this.newOrder.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
    const totalBeforeDiscount = baseTotal + extras;

    if (this.discountType === 'percentage') {
      // Descuento porcentual
      return (totalBeforeDiscount * this.discount) / 100;
    } else {
      // Descuento fijo
      return this.discount;
    }
  }
  /*

  /*
  applyDiscount(): void {
    if (this.discount > 0 && !this.hasDiscountApplied) {
      // Marcar que hay descuento aplicado
      this.hasDiscountApplied = true;

      // Guardar datos del descuento
      this.newOrder.discount = this.discount;
      this.newOrder.discount_type = this.discountType;

      // Recalcular todo con el descuento aplicado
      this.updateOrderTotalWithExtras();
    } else if (this.discount <= 0) {
      alert('Por favor, ingrese un valor de descuento válido.');
    }
  }
  */

  /*
  clearDiscount(): void {
    // Limpiar variables
    this.discount = 0;
    this.discountType = 'fixed';
    this.hasDiscountApplied = false;
    this.newOrder.discount = 0;
    this.newOrder.discount_type = 'fixed';
    this.totalBeforeDiscount = 0;

    // Recalcular sin descuento
    this.updateOrderTotalWithExtras();
  }
    */

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

  /*
  openCalculator(): void {
    this.showCalculator = true;
    this.calculationType = null;
    this.resetForm();
  }
  */

  /*
  closeCalculator(): void {
    this.showCalculator = false;
    this.resetForm();
  }
  */

  /* MÉTODOS CALCULADORA DE PRECIOS
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
    */

  /*
  setValoresPorCliente(): void {
    if (this.clientType === 'intermediary') {
      this.laminationValue = this.variables.intermediaryLaminationValue;
      this.printValue = this.variables.intermediaryPrintValue;
      this.stampingValue = this.variables.intermediaryStampingValue;
      this.assembleValue = this.variables.intermediaryAssembleValue;
    } else if (this.clientType === 'final') {
      this.laminationValue = this.variables.finalLaminationValue;
      this.printValue = this.variables.finalPrintValue;
      this.stampingValue = this.variables.finalStampingValue;
      this.assembleValue = this.variables.finalAssembleValue;
    }
  }
  */

  /*
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
        valorTiempo = this.variables.baseCutTimeValue;
      } else {
        valorTiempo =
          this.clientType === 'intermediary'
            ? this.usageTime * this.variables.intermediaryPerMinute
            : this.usageTime * this.variables.finalPerMinute;
      }

      this.calculatorResult = this.materialValue + valorTiempo;
    }
  }
  */

  public getRemainingDeliveryDays(order: Orders): number {
    if (!order.delivery_date) return 0;

    const now = new Date();
    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(23, 59, 59, 999);

    const diffTime = deliveryDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDaysRemainingLabel(order: Orders): string {
    if (order.order_completion_status !== 'inProgress') {
      return 'Completo';
    }

    const days = this.getRemainingDeliveryDays(order);
    return days > 0 ? `${days} días` : 'Vencido';
  }

  getDaysRemainingClass(order: Orders): string {
    if (order.order_completion_status !== 'inProgress') {
      return 'text-green-600';
    }

    return this.getRemainingDeliveryDays(order) > 0
      ? 'text-blue-600'
      : 'text-red-600';
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

  onInvoiceFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedInvoiceFile = input.files[0];
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

  /*
  closeStockModal() {
    this.showStockWarningModal = false;
  }
  */

  /*
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
  */

  /*
  async completeStockForOrder(order: Orders): Promise<void> {
    if (!order || !order.id_order) {
      alert('Orden no válida.');
      return;
    }

    // Refrescar materiales para tener stock actualizado
    await this.getMaterials();

    // PRINTS
    if (order.order_type === 'print') {
      const { data: prints, error: printsErr } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order);

      if (printsErr || !prints) {
        alert('Error al cargar las líneas de impresión.');
        return;
      }

      // Verificar si hay cantidades pendientes
      const totalPending = prints.reduce(
        (sum, p) => sum + Number(p.pending_quantity || 0),
        0
      );
      if (totalPending === 0) {
        alert('No hay cantidades pendientes para este pedido.');
        return;
      }

      let totalCompleted = 0;
      let stillPending = 0;
      let stockIssues: string[] = [];

      for (const p of prints) {
        const pendingQty = Number(p.pending_quantity || 0);
        if (pendingQty === 0) continue;

        const material = this.allMaterials.find(
          (m: any) =>
            m.category === p.category &&
            m.type === p.material_type &&
            m.caliber === p.caliber &&
            m.color === p.color
        );

        if (!material) {
          stockIssues.push(
            `Material no encontrado: ${p.category} - ${p.material_type}`
          );
          stillPending += pendingQty;
          continue;
        }

        const availableStock = Number(material.material_quantity || 0);
        const toFulfill = Math.min(availableStock, pendingQty);

        if (toFulfill > 0) {
          const newStock = availableStock - toFulfill;
          await this.supabase
            .from('materials')
            .update({ material_quantity: newStock.toString() })
            .eq('id_material', material.id_material);

          const newFulfilled = Number(p.fulfilled_quantity || 0) + toFulfill;
          const newPending = pendingQty - toFulfill;

          await this.supabase
            .from('prints')
            .update({
              fulfilled_quantity: newFulfilled,
              pending_quantity: newPending,
            })
            .eq('id', p.id);

          totalCompleted += toFulfill;
          stillPending += newPending;

          if (newPending > 0) {
            stockIssues.push(
              `${p.category} - ${p.material_type}: Completadas ${toFulfill}, Faltan ${newPending}`
            );
          }
        } else {
          stillPending += pendingQty;
          stockIssues.push(
            `${p.category} - ${p.material_type}: Sin stock (necesita ${pendingQty})`
          );
        }
      }

      if (totalCompleted === 0) {
        alert(
          '❌ NO SE PUDO COMPLETAR STOCK\n\n' +
            'No hay suficiente material en el inventario.\n\n' +
            'Detalles:\n' +
            stockIssues.join('\n')
        );
        return;
      }

      const newStatus =
        stillPending === 0 ? 'fulfilled' : 'partially_fulfilled';
      await this.supabase
        .from('orders')
        .update({
          stock_status: newStatus,
          pending_quantity: stillPending,
        })
        .eq('id_order', order.id_order);

      await this.getOrders();
      await this.getMaterials(); // Refrescar inventario

      if (stillPending === 0) {
        alert(
          `✅ Stock completado exitosamente.\n\nSe cumplieron ${totalCompleted} unidades.`
        );
      } else {
        alert(
          `⚠️ Stock parcialmente completado.\n\n` +
            `Completadas: ${totalCompleted} unidades\n` +
            `Aún pendientes: ${stillPending} unidades\n\n` +
            `Detalles:\n${stockIssues.join('\n')}`
        );
      }
    }

    // LASER (CUTS)
    else if (order.order_type === 'laser') {
      const { data: cuts, error: cutsErr } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order);

      if (cutsErr || !cuts) {
        alert('Error al cargar las líneas de corte.');
        return;
      }

      // Verificar si hay cantidades pendientes
      const totalPending = cuts.reduce(
        (sum, c) => sum + Number(c.pending_quantity || 0),
        0
      );
      if (totalPending === 0) {
        alert('No hay cantidades pendientes para este pedido.');
        return;
      }

      let totalCompleted = 0;
      let stillPending = 0;
      let stockIssues: string[] = [];

      for (const c of cuts) {
        const pendingQty = Number(c.pending_quantity || 0);
        if (pendingQty === 0) continue;

        const material = this.allMaterials.find(
          (m: any) =>
            m.category === c.category &&
            m.type === c.material_type &&
            m.caliber === c.caliber &&
            m.color === c.color
        );

        if (!material) {
          stockIssues.push(
            `Material no encontrado: ${c.category} - ${c.material_type}`
          );
          stillPending += pendingQty;
          continue;
        }

        const availableStock = Number(material.material_quantity || 0);
        const toFulfill = Math.min(availableStock, pendingQty);

        if (toFulfill > 0) {
          const newStock = availableStock - toFulfill;
          await this.supabase
            .from('materials')
            .update({ material_quantity: newStock.toString() })
            .eq('id_material', material.id_material);

          const newFulfilled = Number(c.fulfilled_quantity || 0) + toFulfill;
          const newPending = pendingQty - toFulfill;

          await this.supabase
            .from('cuts')
            .update({
              fulfilled_quantity: newFulfilled,
              pending_quantity: newPending,
            })
            .eq('id', c.id);

          totalCompleted += toFulfill;
          stillPending += newPending;

          if (newPending > 0) {
            stockIssues.push(
              `${c.category} - ${c.material_type}: Completadas ${toFulfill}, Faltan ${newPending}`
            );
          }
        } else {
          stillPending += pendingQty;
          stockIssues.push(
            `${c.category} - ${c.material_type}: Sin stock (necesita ${pendingQty})`
          );
        }
      }

      if (totalCompleted === 0) {
        alert(
          '❌ NO SE PUDO COMPLETAR STOCK\n\n' +
            'No hay suficiente material en el inventario.\n\n' +
            'Detalles:\n' +
            stockIssues.join('\n')
        );
        return;
      }

      const newStatus =
        stillPending === 0 ? 'fulfilled' : 'partially_fulfilled';
      await this.supabase
        .from('orders')
        .update({
          stock_status: newStatus,
          pending_quantity: stillPending,
        })
        .eq('id_order', order.id_order);

      await this.getOrders();
      await this.getMaterials(); // Refrescar inventario

      if (stillPending === 0) {
        alert(
          `✅ Stock completado exitosamente.\n\nSe cumplieron ${totalCompleted} unidades.`
        );
      } else {
        alert(
          `⚠️ Stock parcialmente completado.\n\n` +
            `Completadas: ${totalCompleted} unidades\n` +
            `Aún pendientes: ${stillPending} unidades\n\n` +
            `Detalles:\n${stockIssues.join('\n')}`
        );
      }
    }

    // SALES
    else if (order.order_type === 'sales') {
      alert('Para ventas, usa el proceso normal de completar ítems.');
      return;
    } else {
      alert('Tipo de pedido no soportado.');
      return;
    }
  }
  */

  /* Función para añadir un material a prints
  addPrintItem(): void {
    if (this.newOrder.order_type !== 'print') return;

    const selectedMaterial = this.getSelectedMaterial();
    if (!selectedMaterial) {
      alert(
        'Seleccione un material completo (categoría, tipo, calibre y color).'
      );
      return;
    }

    const qty = Number(this.tempPrintQuantity) || 0;
    const unitValue = Number(this.tempPrintUnitaryValue) || 0;

    if (qty <= 0) {
      alert('La cantidad debe ser mayor a cero.');
      return;
    }

    if (unitValue <= 0) {
      alert('El valor unitario debe ser mayor a cero.');
      return;
    }

    // Calcular el valor unitario procesado (con multiplicadores de procesos)
    const processedUnitValue = this.calculatePrintValueFromUnit(unitValue);

    this.printsItems.push({
      material: selectedMaterial,
      quantity: qty,
      laminating: this.tempPrintLaminating,
      die_cutting: this.tempPrintDieCutting,
      assembly: this.tempPrintAssembly,
      printing: this.tempPrintPrinting,
      unitary_value: unitValue,
      processed_unit_value: processedUnitValue,
      subtotal: qty * processedUnitValue,
      roll_width: this.tempPrintRollWidth || 0,
      measurement: this.tempPrintMeasurement || 0,
      processes: this.getProcessesString(),
    });

    // Limpiar campos temporales
    this.resetTempPrintFields();

    // Recalcular el total del pedido
    this.recalcPrintsFromItems();
  }
  */
  /*
  calculatePrintValueFromUnit(unitValue: number): number {
    const clientType = this.newOrder.client_type || 'intermediary';

    let totalValue = unitValue; // Empezar con el valor ingresado

    // Multiplicar en cadena según los procesos seleccionados
    if (clientType === 'final') {
      if (this.tempPrintLaminating) {
        totalValue = totalValue * this.variables.finalLaminationValue;
      }
      if (this.tempPrintPrinting) {
        totalValue = totalValue * this.variables.finalPrintValue;
      }
      if (this.tempPrintDieCutting) {
        totalValue = totalValue * this.variables.finalStampingValue;
      }
      if (this.tempPrintAssembly) {
        totalValue = totalValue * this.variables.finalAssembleValue;
      }
    } else {
      // intermediary
      if (this.tempPrintLaminating) {
        totalValue = totalValue * this.variables.intermediaryLaminationValue;
      }
      if (this.tempPrintPrinting) {
        totalValue = totalValue * this.variables.intermediaryPrintValue;
      }
      if (this.tempPrintDieCutting) {
        totalValue = totalValue * this.variables.intermediaryStampingValue;
      }
      if (this.tempPrintAssembly) {
        totalValue = totalValue * this.variables.intermediaryAssembleValue;
      }
    }

    return totalValue;
  }
  */

  /* Función para obtener string de procesos
  getProcessesString(): string {
    const processes = [];
    if (this.tempPrintLaminating) processes.push('Laminado');
    if (this.tempPrintPrinting) processes.push('Impresión');
    if (this.tempPrintDieCutting) processes.push('Troquelado');
    if (this.tempPrintAssembly) processes.push('Armado');
    return processes.join(', ') || '-';
  }
  */

  /* Resetear campos temporales
  resetTempPrintFields(): void {
    this.tempPrintQuantity = 1;
    this.tempPrintLaminating = false;
    this.tempPrintDieCutting = false;
    this.tempPrintAssembly = false;
    this.tempPrintPrinting = false;
    this.tempPrintUnitaryValue = 0;
    this.selectedCategory = '';
    this.selectedType = '';
    this.selectedCaliber = '';
    this.selectedColor = '';
  }
  */

  /* Eliminar un item de prints
  removePrintItem(index: number): void {
    // Si es el último item, preguntar si quiere eliminar el pedido completo
    if (this.printsItems.length === 1 && this.isEditing) {
      const confirmDelete = confirm(
        '⚠️ ADVERTENCIA: Este es el último material del pedido.\n\n' +
          'Si lo eliminas, el pedido completo será eliminado.\n\n' +
          '¿Deseas eliminar el pedido completo?'
      );

      if (!confirmDelete) {
        return; // Usuario canceló
      }

      // Buscar el pedido en la lista de orders
      const orderToDelete = this.orders.find(
        (o) => o.id_order === this.newOrder.id_order
      );

      if (orderToDelete) {
        // Llamar al método deleteOrder existente que ya maneja todo
        this.deleteOrder(orderToDelete);
      } else {
        alert('No se pudo encontrar el pedido para eliminar.');
      }

      return; // No continuar con la eliminación del item
    }

    // Si NO es el último item, eliminar normalmente
    this.printsItems.splice(index, 1);

    if (this.printsItems.length === 0) {
      this.isPrintsModeLocked = false;
    }

    // Recalcular totales
    this.recalcPrintsFromItems();
  }
  */

  async deleteOrderCompletely(orderId: string): Promise<void> {
    try {
      // 1. Eliminar prints
      await this.supabase.from('prints').delete().eq('id_order', orderId);

      // 2. Eliminar notificaciones
      await this.supabase
        .from('notifications')
        .delete()
        .eq('id_order', orderId);

      // 3. Eliminar facturas
      await this.supabase.from('invoices').delete().eq('id_order', orderId);

      // 4. Eliminar pagos
      await this.supabase.from('payments').delete().eq('id_order', orderId);

      // 5. Eliminar el pedido
      await this.supabase.from('orders').delete().eq('id_order', orderId);

      alert('El pedido fue eliminado correctamente.');

      // Cerrar el modal y recargar pedidos
      this.toggleAddOrderForm();
      await this.getOrders();
    } catch (error) {
      console.error('Error eliminando pedido:', error);
      alert('Error al eliminar el pedido.');
    }
  }

  /* Recalcular total desde los items
  recalcPrintsFromItems(): void {
    let total = 0;
    for (const item of this.printsItems) {
      total += item.subtotal;
    }

    this.newOrder.base_total = total;
    this.updateOrderTotalWithExtras();
  }
  */

  // Funciones para obtener opciones únicas de materiales
  getCategories(): string[] {
    const categories = this.allMaterials
      .map((m) => m.category)
      .filter((c) => c);
    return [...new Set(categories)];
  }

  getTypes(): string[] {
    let filtered = this.allMaterials;
    if (this.selectedCategory) {
      filtered = filtered.filter((m) => m.category === this.selectedCategory);
    }
    const types = filtered.map((m) => m.type).filter((t) => t);
    return [...new Set(types)];
  }

  getCalibers(): string[] {
    let filtered = this.allMaterials;
    if (this.selectedCategory) {
      filtered = filtered.filter((m) => m.category === this.selectedCategory);
    }
    if (this.selectedType) {
      filtered = filtered.filter((m) => m.type === this.selectedType);
    }

    // Mapear los calibers, dejando vacíos como están (null, undefined, "")
    const calibers = filtered.map((m) => m.caliber || '');

    // Retornar únicos (incluyendo string vacío si existe)
    return [...new Set(calibers)];
  }

  getColors(): string[] {
    let filtered = this.allMaterials;
    if (this.selectedCategory) {
      filtered = filtered.filter((m) => m.category === this.selectedCategory);
    }
    if (this.selectedType) {
      filtered = filtered.filter((m) => m.type === this.selectedType);
    }
    if (this.selectedCaliber !== undefined && this.selectedCaliber !== null) {
      // Comparar considerando valores vacíos
      filtered = filtered.filter((m) => {
        const matCaliber = m.caliber || '';
        return matCaliber === this.selectedCaliber;
      });
    }

    // Mapear los colores, dejando vacíos como están
    const colors = filtered.map((m) => m.color || '');

    // Retornar únicos (incluyendo string vacío si existe)
    return [...new Set(colors)];
  }

  // Función auxiliar para obtener el material seleccionado
  getSelectedMaterial(): any | null {
    if (
      !this.selectedCategory ||
      !this.selectedType ||
      this.selectedCaliber === undefined ||
      this.selectedCaliber === null ||
      this.selectedColor === undefined ||
      this.selectedColor === null
    ) {
      return null;
    }

    return (
      this.allMaterials.find((m) => {
        const categoryMatch = m.category === this.selectedCategory;
        const typeMatch = m.type === this.selectedType;

        // Normalizar a string vacío si es null/undefined
        const matCaliber = m.caliber || '';
        const matColor = m.color || '';

        const caliberMatch = matCaliber === this.selectedCaliber;
        const colorMatch = matColor === this.selectedColor;

        return categoryMatch && typeMatch && caliberMatch && colorMatch;
      }) || null
    );
  }

  /*
  onPrintMaterialChange(): void {
    const material = this.getSelectedMaterial();
    if (material) {
      // Autocompletar el valor unitario del material
      this.tempPrintUnitaryValue = Number(material.unitary_value) || 0;
    } else {
      this.tempPrintUnitaryValue = 0;
    }
  }
  */

  /* Añadir un material a cuts
  addCutItem(): void {
    const material = this.getSelectedMaterial();

    if (!material) {
      alert(
        'Seleccione un material completo (Categoría, Tipo, Calibre, Color).'
      );
      return;
    }

    const quantity = Number(this.tempCutQuantity) || 0;
    const cutTime = Number(this.tempCutTime) || 0;
    const unitPrice = Number(this.tempCutUnitaryValue) || 0;

    if (quantity <= 0) {
      alert('La cantidad debe ser mayor a cero.');
      return;
    }

    if (cutTime < 0) {
      alert('El tiempo de corte no puede ser negativo.');
      return;
    }

    // Calcular el costo del corte
    const cutCost = this.calculateCutCost(cutTime);

    // FÓRMULA: Total = (Precio Unitario × cantidad) + costo de corte
    const totalPrice = unitPrice * quantity + cutCost;

    // Guardar en el array temporal de items
    this.cutsItems.push({
      material: material,
      quantity: quantity,
      height: this.tempCutHeight || 0,
      width: this.tempCutWidth || 0,
      cutTime: cutTime,
      unitPrice: unitPrice,
      processedValue: cutCost,
      subtotal: totalPrice,
    });

    // Limpiar campos temporales
    this.selectedCategory = '';
    this.selectedType = '';
    this.selectedCaliber = '';
    this.selectedColor = '';
    this.tempCutQuantity = 1;
    this.tempCutHeight = 0;
    this.tempCutWidth = 0;
    this.tempCutTime = 0;
    this.tempCutNotes = '';
    this.tempCutUnitaryValue = 0;

    // Recalcular totales
    this.recalcCutsFromItems();
  }

  */

  /* Calcular SOLO el costo del corte (sin material)
  calculateCutCost(cutTime: number): number {
    const clientType = this.newOrder.client_type;
    let cutCost = 0;

    if (clientType === 'intermediary') {
      // Cliente Intermediario
      const ratePerMinute = this.variables.intermediaryPerMinute || 800;
      const minCharge = this.variables.baseCutTimeValue || 8000;

      if (cutTime <= 10) {
        cutCost = minCharge;
      } else {
        cutCost = ratePerMinute * cutTime;
      }
    } else {
      // Cliente Final
      const ratePerMinute = this.variables.finalPerMinute || 1000;
      const minCharge = 10000; // Valor fijo para cliente final (10 min)

      if (cutTime <= 10) {
        cutCost = minCharge;
      } else {
        cutCost = ratePerMinute * cutTime;
      }
    }

    return cutCost;
  }
  */

  /*
   * Calcular el valor del cut basado en tiempo de corte

  calculateCutValue(material: any, cutTime: number): number {
    const materialValue = Number(material.unitaryvalue) || 0;
    const cutCost = this.calculateCutCost(cutTime);

    // Retornar solo el material + corte (sin multiplicar por cantidad aquí)
    return materialValue + cutCost;
  }
    */

  /**
   * Resetear campos temporales de cuts

  resetTempCutFields(): void {
    this.tempCutQuantity = 1;
    this.tempCutHeight = 0;
    this.tempCutWidth = 0;
    this.tempCutTime = 0;
    this.tempCutNotes = '';
    this.selectedCategory = '';
    this.selectedType = '';
    this.selectedCaliber = '';
    this.selectedColor = '';
  }
    */

  /**
   * Eliminar un item de corte con validación

  removeCutItem(index: number): void {
    // Si es el último item, confirmar eliminación
    if (this.cutsItems.length === 1) {
      const confirmDelete = confirm(
        '⚠️ Este es el último material del pedido.\n\n' +
          'Si lo eliminas, se borrará todo el pedido.\n\n' +
          '¿Estás seguro de que deseas continuar?'
      );

      if (!confirmDelete) {
        return; // Cancelar eliminación
      }

      // Si confirma, eliminar el pedido completo
      if (this.isEditing && this.newOrder.id_order) {
        this.deleteOrder(this.selectedOrder!);
        this.toggleAddOrderForm(); // Cerrar el modal
        return;
      } else {
        // Si es un pedido nuevo (no guardado aún), simplemente cerrar el modal
        this.cutsItems = [];
        this.toggleAddOrderForm();
        return;
      }
    }

    // Si hay más de un item, eliminarlo normalmente
    this.cutsItems.splice(index, 1);
    this.recalcCutsFromItems();
  }
    */

  /**
   * Recalcular totales del pedido desde cutsItems

  recalcCutsFromItems(): void {
    if (!this.newOrder || this.newOrder.order_type !== 'laser') {
      return;
    }

    // 1. Calcular base_total (suma de subtotales de todos los items)
    let baseTotal = 0;
    for (const item of this.cutsItems) {
      baseTotal += item.subtotal;
    }

    this.newOrder.base_total = baseTotal;

    // 2. Aplicar extras
    const extras =
      this.newOrder.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;

    // 3. Calcular total antes de descuento
    let totalBeforeDiscount = baseTotal + extras;

    // 4. Aplicar descuento si existe
    let discountAmount = 0;
    if (this.hasDiscountApplied && this.discount > 0) {
      if (this.discountType === 'percentage') {
        discountAmount = (totalBeforeDiscount * this.discount) / 100;
      } else {
        discountAmount = this.discount;
      }
      this.totalBeforeDiscount = totalBeforeDiscount;
    }

    // 5. Total final
    const finalTotal = Math.max(0, totalBeforeDiscount - discountAmount);

    // 6. Actualizar el pedido
    this.newOrder.subtotal = baseTotal.toString();
    this.newOrder.total = finalTotal.toString();
  }
    */

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
    // ARCHIVO DE TRABAJO
    if (this.selectedFile) {
      const file = this.selectedFile;
      const filePath = `${orderId}/work/${Date.now()}_${file.name}`;

      await this.uploadOrderFile(orderId, filePath, file);

      await this.supabase
        .from('orders')
        .update({ file_path: filePath })
        .eq('id_order', orderId);

      this.newOrder.file_path = filePath;
      this.selectedFile = null;
    }

    // ARCHIVO DE FACTURA
    if (this.selectedInvoiceFile) {
      const file = this.selectedInvoiceFile;
      const filePath = `${orderId}/invoice/${Date.now()}_${file.name}`;

      await this.uploadOrderFile(orderId, filePath, file);

      await this.supabase
        .from('orders')
        .update({ invoice_file: filePath })
        .eq('id_order', orderId);

      this.newOrder.invoice_file = filePath;
      this.selectedInvoiceFile = null;
    }

    this.uploadedFileName = null;
  }
}
