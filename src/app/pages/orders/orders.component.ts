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
          });
          this.getOrders();
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

  // ======= Construye la fila para la tabla `sales` (venta-material) =======
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

  // ======= Crea/actualiza la línea de VENTA → MATERIAL y ajusta stock =======
  private async upsertSaleMaterialLine(orderId: string): Promise<boolean> {
    const selectedMaterial = this.getSelectedMaterial ? this.getSelectedMaterial() : null;

    // Si no hay selección de material, no hacemos nada (permitir pedido sin detalle)
    if (!selectedMaterial || !selectedMaterial.id_material) {
      return true;
    }

    const newQty = Number(this.saleMaterialQuantity) || 0;
    if (newQty <= 0) {
      alert('La cantidad debe ser mayor a cero.');
      return false;
    }

    // 1) ¿Ya existe línea de venta-material para este pedido?
    const { data: existing, error: selErr } = await this.supabase
      .from('sales')
      .select('id_sale, material_id, quantity')
      .eq('id_order', orderId)
      .eq('item_type', 'material')
      .maybeSingle();

    if (selErr && selErr.code !== 'PGRST116') {
      console.error('Error consultando sale(material):', selErr);
      return false;
    }

    // helpers locales para stock de materiales
    const readMaterialQty = async (materialId: string): Promise<number | null> => {
      const { data, error } = await this.supabase
        .from('materials')
        .select('material_quantity')
        .eq('id_material', materialId)
        .single();
      if (error || !data) return null;
      return parseFloat(data.material_quantity);
    };

    const updateMaterialQty = async (materialId: string, newQtyValue: number) => {
      const { error } = await this.supabase
        .from('materials')
        .update({ material_quantity: String(newQtyValue) })
        .eq('id_material', materialId);
      if (error) {
        console.error('Error actualizando stock de material:', error);
        throw error;
      }
    };

    if (existing) {
      // 2) EDITAR: puede cambiar el material o solo la cantidad
      const oldMaterialId = existing.material_id as string;
      const oldQty = Number(existing.quantity) || 0;

      if (oldMaterialId !== selectedMaterial.id_material) {
        const oldCurrent = await readMaterialQty(oldMaterialId);
        if (oldCurrent === null) {
          alert('No se pudo leer stock del material anterior.');
          return false;
        }
        await updateMaterialQty(oldMaterialId, oldCurrent + oldQty);

        const newCurrent = await readMaterialQty(selectedMaterial.id_material);
        if (newCurrent === null) {
          alert('No se pudo leer stock del nuevo material.');
          return false;
        }
        if (newCurrent < newQty) {
          this.stockWarningMessage = `No hay suficiente stock. Disponible: ${newCurrent}`;
          const proceed = await this.confirmStockOverride();
          if (!proceed) return false;
        }
        await updateMaterialQty(selectedMaterial.id_material, Math.max(newCurrent - newQty, 0));

        const row = this.buildSaleRowMaterial(orderId, selectedMaterial);
        const { error: updErr } = await this.supabase
          .from('sales')
          .update(row)
          .eq('id_sale', existing.id_sale);
        if (updErr) {
          console.error('Error actualizando sale(material):', updErr);
          return false;
        }
        return true;

      } else {
        const diff = newQty - oldQty;
        if (diff !== 0) {
          const current = await readMaterialQty(selectedMaterial.id_material);
          if (current === null) {
            alert('No se pudo leer stock del material.');
            return false;
          }
          if (diff > 0 && current < diff) {
            this.stockWarningMessage = `No hay suficiente stock. Disponible: ${current}`;
            const proceed = await this.confirmStockOverride();
            if (!proceed) return false;
          }
          await updateMaterialQty(
            selectedMaterial.id_material,
            diff > 0 ? Math.max(current - diff, 0) : current + Math.abs(diff)
          );
        }

        const row = this.buildSaleRowMaterial(orderId, selectedMaterial);
        const { error: updErr } = await this.supabase
          .from('sales')
          .update(row)
          .eq('id_sale', existing.id_sale);
        if (updErr) {
          console.error('Error actualizando sale(material):', updErr);
          return false;
        }
        return true;
      }

    } else {
      // 3) CREAR: validar stock y crear línea
      const current = await readMaterialQty(selectedMaterial.id_material);
      if (current === null) {
        alert('No se pudo leer stock del material.');
        return false;
      }
      if (current < newQty) {
        this.stockWarningMessage = `No hay suficiente stock. Disponible: ${current}`;
        const proceed = await this.confirmStockOverride();
        if (!proceed) return false;
      }
      await updateMaterialQty(selectedMaterial.id_material, Math.max(current - newQty, 0));

      const row = this.buildSaleRowMaterial(orderId, selectedMaterial);
      const { error: insErr } = await this.supabase.from('sales').insert([row]);
      if (insErr) {
        console.error('Error insertando sale(material):', insErr);
        return false;
      }
      return true;
    }
  }


  private isSaleActive(): boolean {
    return this.newOrder?.order_type === 'sales' && (this.saleMode === 'material' || this.saleMode === 'product');
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
    const p = this.allProducts.find(x => x.id === this.selectedProductId);
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

  private async upsertSaleProductLine(orderId: string): Promise<boolean> {
  const p = this.allProducts.find(x => x.id === this.selectedProductId);
    if (!p || !p.id) {
      // Si no hay producto, no hacer nada (permite pedidos sin producto)
      return true; 
    }

    const newQty = Number(this.saleMaterialQuantity) || 0;
    if (newQty <= 0) {
      alert('La cantidad debe ser mayor a cero.');
      return false;
    }

    // 1) Buscar si ya hay línea de producto para este pedido
    const { data: existing, error: selErr } = await this.supabase
      .from('sales')
      .select('id_sale, product_id, quantity')
      .eq('id_order', orderId)
      .eq('item_type', 'product')
      .maybeSingle();

    if (selErr && selErr.code !== 'PGRST116') {
      console.error('Error consultando sale(product):', selErr);
      return false;
    }

    const readProductStock = async (productId: string): Promise<number | null> => {
      const { data, error } = await this.supabase
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single();
      if (error || !data) return null;
      return Number(data.stock) || 0;
    };

    const updateProductStock = async (productId: string, newStock: number) => {
      const { error } = await this.supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);
      if (error) {
        console.error('Error actualizando stock de producto:', error);
        throw error;
      }
    };

    if (existing) {
      // 2) EDITAR: puede cambiar el producto o solo la cantidad
      const oldProductId = existing.product_id as string;
      const oldQty = Number(existing.quantity) || 0;

      if (oldProductId !== p.id) {
        const oldCurrent = await readProductStock(oldProductId);
        if (oldCurrent === null) {
          alert('No se pudo leer stock del producto anterior.');
          return false;
        }
        await updateProductStock(oldProductId, oldCurrent + oldQty);

        const newCurrent = await readProductStock(p.id);
        if (newCurrent === null) {
          alert('No se pudo leer stock del nuevo producto.');
          return false;
        }
        if (newCurrent < newQty) {
          this.stockWarningMessage = `No hay suficiente stock. Disponible: ${newCurrent}`;
          const proceed = await this.confirmStockOverride();
          if (!proceed) return false;
        }
        await updateProductStock(p.id, Math.max(newCurrent - newQty, 0));

        const row = this.buildSaleRowProduct(orderId, p);
        const { error: updErr } = await this.supabase
          .from('sales')
          .update(row)
          .eq('id_sale', existing.id_sale);
        if (updErr) {
          console.error('Error actualizando sale(product):', updErr);
          return false;
        }
        return true;

      } else {
        const diff = newQty - oldQty;
        if (diff !== 0) {
          const current = await readProductStock(p.id);
          if (current === null) {
            alert('No se pudo leer stock del producto.');
            return false;
          }
          if (diff > 0 && current < diff) {
            this.stockWarningMessage = `No hay suficiente stock. Disponible: ${current}`;
            const proceed = await this.confirmStockOverride();
            if (!proceed) return false;
          }
          await updateProductStock(
            p.id,
            diff > 0 ? Math.max(current - diff, 0) : current + Math.abs(diff)
          );
        }

        const row = this.buildSaleRowProduct(orderId, p);
        const { error: updErr } = await this.supabase
          .from('sales')
          .update(row)
          .eq('id_sale', existing.id_sale);
        if (updErr) {
          console.error('Error actualizando sale(product):', updErr);
          return false;
        }
        return true;
      }

    } else {
      // 3) CREAR: validar stock y crear línea
      const current = await readProductStock(p.id);
      if (current === null) {
        alert('No se pudo leer stock del producto.');
        return false;
      }
      if (current < newQty) {
        this.stockWarningMessage = `No hay suficiente stock. Disponible: ${current}`;
        const proceed = await this.confirmStockOverride();
        if (!proceed) return false;
      }

      await updateProductStock(p.id, Math.max(current - newQty, 0));

      const row = this.buildSaleRowProduct(orderId, p);
      const { error: insErr } = await this.supabase.from('sales').insert([row]);
      if (insErr) {
        console.error('Error insertando sale(product):', insErr);
        return false;
      }
      return true;
    }
  }

  getProductNameById(productId: string | null | undefined): string {
    if (!productId) return '';
    const product = this.allProducts?.find(p => p.id === productId);
    return product ? product.name : '';
  }


  asNumber(v: any): number {
    return typeof v === 'number' ? v : Number(v || 0);
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
            console.error('Error al eliminar registros de sales:', deleteSalesError);
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
        return matchesDateRange && matchesNameSearch && matchesScheduler;;
      }

      const isPrintsFilter = this.showPrints && order.order_type === 'print';
      const isCutsFilter = this.showCuts && order.order_type === 'laser';
      const isSalesFilter = this.showSales && order.order_type === 'sales';

      const matchesType = isPrintsFilter || isCutsFilter || isSalesFilter;

      return matchesType && matchesDateRange && matchesNameSearch && matchesScheduler;;
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
        order.order_type === 'sale'  ||
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
        extra_charges: order.extra_charges || []
      }
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
  const newDeliveryStatus = newCompletionStatus === 'finished' ? 'Completado' : 'toBeDelivered';

  const { error } = await this.supabase
    .from('orders')
    .update({
      order_completion_status: newCompletionStatus,
      order_delivery_status: newDeliveryStatus
    })
    .eq('id_order', order.id_order);

  if (error) {
    console.error('Error actualizando estado:', error);
    // Revertir el cambio local en caso de error
    order.order_completion_status = order.order_completion_status === 'finished' ? 'standby' : 'finished';
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
      this.saleMode = 'none';
      this.saleMaterialQuantity = 1;
      this.saleMaterialUnitPrice = 0;
      this.selectedCategory = '';
      this.selectedType = '';
      this.selectedCaliber = '';
      this.selectedColor = '';
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

    // === BASE TOTAL: calcula sin romper si extra_charges no es array ===
    const extrasArray = Array.isArray(this.newOrder.extra_charges)
      ? this.newOrder.extra_charges
      : [];

    if (!this.newOrder.base_total || isNaN(Number(this.newOrder.base_total))) {
      if (this.newOrder.subtotal && !isNaN(Number(this.newOrder.subtotal))) {
        this.newOrder.base_total = Number(this.newOrder.subtotal);
      } else {
        const extrasSum = extrasArray.reduce((sum: number, c: any) => sum + Number(c?.amount || 0), 0);
        this.newOrder.base_total = Number(this.newOrder.total || 0) - extrasSum;
      }
    }

    // ================== PRINT ==================
    if (order.order_type === 'print') {
      const { data, error } = await this.supabase
        .from('prints')
        .select('*')
        .eq('id_order', order.id_order)
        .maybeSingle();

      if (!error && data) this.newPrint = { ...data };

      this.selectedCategory = this.newPrint?.category ?? '';
      this.selectedType     = this.newPrint?.material_type ?? '';
      this.selectedCaliber  = this.newPrint?.caliber ?? '';
      this.selectedColor    = this.newPrint?.color ?? '';

    // ================== LASER ==================
    } else if (order.order_type === 'laser') {
      const { data, error } = await this.supabase
        .from('cuts')
        .select('*')
        .eq('id_order', order.id_order)
        .maybeSingle();

      if (!error && data) this.newCut = { ...data };

      this.selectedCategory = this.newCut?.category ?? '';
      this.selectedType     = this.newCut?.material_type ?? '';
      this.selectedCaliber  = this.newCut?.caliber ?? '';
      this.selectedColor    = this.newCut?.color ?? '';

    // ================== SALES ==================
    } else if (this.newOrder.order_type === 'sales') {
      // Busca 1 línea (material o producto). Si no hay, es "cotización convertida".
      const { data: rows, error } = await this.supabase
        .from('sales')
        .select('item_type, product_id, material_id, quantity, unit_price, material_type, caliber, color, category')
        .eq('id_order', order.id_order)
        .limit(1);

      if (error) console.warn('editOrder> sales lookup error:', error);

      const row = Array.isArray(rows) ? rows[0] : null;

      if (!row) {
        this.saleMode = 'none';
        this.selectedProductId = '';
        this.saleMaterialQuantity  = 1;
        this.saleMaterialUnitPrice = 0;

        this.selectedCategory = '';
        this.selectedType     = '';
        this.selectedCaliber  = '';
        this.selectedColor    = '';

        this.newOrder.base_total = Number(this.newOrder.base_total || 0);
        this.updateOrderTotalWithExtras();
        return;
      }

      // Sí hay línea en `sales`
      this.saleMaterialQuantity  = Number(row.quantity)   || 1;
      this.saleMaterialUnitPrice = Number(row.unit_price) || 0;

      if (row.item_type === 'product') {
        // ----- PRODUCTO -----
        this.saleMode = 'product';
        this.selectedProductId = row.product_id || '';

        // limpia selects de material
        this.selectedCategory = '';
        this.selectedType     = '';
        this.selectedCaliber  = '';
        this.selectedColor    = '';

      } else if (row.item_type === 'material') {
        // ----- MATERIAL -----
        this.saleMode = 'material';
        this.selectedProductId = '';

        // usa snapshots si existen
        this.selectedCategory = row.category       || '';
        this.selectedType     = row.material_type  || '';
        this.selectedCaliber  = row.caliber        || '';
        this.selectedColor    = row.color          || '';

      } else {
        // Valor inesperado → trata como none
        this.saleMode = 'none';
      }

      // Recalcula solo si hay material/producto
      if (this.saleMode === 'material' || this.saleMode === 'product') {
        this.recalcSalesTotal(); // setea base_total y suma extras
        this.newOrder.order_quantity = String(this.saleMaterialQuantity);
      } else {
        this.updateOrderTotalWithExtras();
      }
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
    const extras = newOrderForm.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;
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
        this.recalcSalesTotal();
      }

      if (this.selectedFile) {
        const file = this.selectedFile;
        const filePath = `order-files/${newOrderForm.id_order}/${Date.now()}_${
          file.name
        }`;
        this.newOrder.file_path = filePath;
        await this.uploadOrderFile(newOrderForm.id_order, filePath, file);
      }

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


        if (selectedMaterial) {
          const quantityToUse = parseInt(this.newPrint.quantity || '0');

          if (parseFloat(selectedMaterial.material_quantity) < quantityToUse) {
            this.stockWarningMessage = `No hay suficiente stock. Disponible: ${selectedMaterial.material_quantity}`;
            const proceed = await this.confirmStockOverride();
            if (!proceed) return;
          }

          const newStock =
            parseFloat(selectedMaterial.material_quantity) - quantityToUse;

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
        };

        const { data: existingPrint, error: printSearchError } = await this.supabase
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
      } else if (this.newOrder.order_type === 'laser') {
        const selectedMaterial = this.getSelectedMaterial();


        if (selectedMaterial) {
          const quantityToUse = parseInt(this.newCut.quantity || '0');

          if (parseFloat(selectedMaterial.material_quantity) < quantityToUse) {
            this.stockWarningMessage = `No hay suficiente stock. Disponible: ${selectedMaterial.material_quantity}`;
            const proceed = await this.confirmStockOverride();
            if (!proceed) return;
          }

          const newStock =
            parseFloat(selectedMaterial.material_quantity) - quantityToUse;

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
      } else if (this.newOrder.order_type === 'sales') {
        this.recalcSalesTotal();
        if (this.saleMode === 'material') {
          const ok = await this.upsertSaleMaterialLine(this.newOrder.id_order!);
          if (!ok) return;
        } else if (this.saleMode === 'product') {
          const ok = await this.upsertSaleProductLine(this.newOrder.id_order!);
          if (!ok) return;
        } else {
          // saleMode === 'none' -> no hacer nada con stock/tabla sales
        }
      }
      // ????
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
        this.recalcSalesTotal();
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

      if (this.newOrder.order_type === 'print') {
        const selectedMaterial = this.getSelectedMaterial();


        if (selectedMaterial) {
          const quantityToUse = parseInt(this.newPrint.quantity || '0');

          if (parseFloat(selectedMaterial.material_quantity) < quantityToUse) {
            this.stockWarningMessage = `No hay suficiente stock. Disponible: ${selectedMaterial.material_quantity}`;
            const proceed = await this.confirmStockOverride();
            if (!proceed) return;
          }

          const newStock =
            parseFloat(selectedMaterial.material_quantity) - quantityToUse;

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
        };

        const { error: printError } = await this.supabase
          .from('prints')
          .insert([printData]);

        if (printError) {
          console.error('Error al insertar datos de impresión:', printError);
          return;
        }

        this.createNotification(insertedOrder);
      } else if (this.newOrder.order_type === 'laser') {
        const selectedMaterial = this.getSelectedMaterial();


        if (selectedMaterial) {
          const quantityToUse = parseInt(this.newCut.quantity || '0');

          if (parseFloat(selectedMaterial.material_quantity) < quantityToUse) {
            this.stockWarningMessage = `No hay suficiente stock. Disponible: ${selectedMaterial.material_quantity}`;
            const proceed = await this.confirmStockOverride();
            if (!proceed) return;
          }

          const newStock =
            parseFloat(selectedMaterial.material_quantity) - quantityToUse;

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
        };

        const { error: cutError } = await this.supabase
          .from('cuts')
          .insert([cutData]);
        if (cutError) {
          console.error('Error al insertar datos de corte:', cutError);
          return;
        }
        this.createNotification(insertedOrder);
      }else if (this.newOrder.order_type === 'sales') {
        if (this.saleMode === 'material') {
          const ok = await this.upsertSaleMaterialLine(this.newOrder.id_order!);
          if (!ok) return;
        } else if( this.saleMode === 'product') {
          const ok = await this.upsertSaleProductLine(this.newOrder.id_order!);
          if (!ok) return;
        } else {
          // saleMode === 'none' -> no hacer nada con stock/tabla sales
        }
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

    // Si el subtotal ya está guardado correctamente (no es 0), úsalo
    const storedSubtotal = parseFloat(order.subtotal as string) || 0;
    if (storedSubtotal > 0) {
      return storedSubtotal;
    }

    // Si el subtotal es 0, calcularlo: Total - Cargos Extras
    const total = parseFloat(order.total as string) || 0;
    const extras = order.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;

    return total - extras;
  }

  extraChargeDescription: string = '';
  extraChargeAmount: number = 0;

  addExtraCharge(): void {
  if (this.extraChargeDescription && this.extraChargeAmount > 0) {
    if (!this.newOrder.extra_charges) {
      this.newOrder.extra_charges = [];
    }

    // Calcular el subtotal ANTES de agregar el cargo (si aún no existe)
    if (!this.newOrder.subtotal || this.newOrder.subtotal === '0') {
      const currentTotal = parseFloat(this.newOrder.total as string) || 0;
      this.newOrder.subtotal = currentTotal.toString();
      this.newOrder.base_total = currentTotal;
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
  // El subtotal base es el valor del total actual SIN cargos extras
  const currentTotal = parseFloat(this.newOrder.total as string) || 0;

  // Calcular suma de cargos extras
  const extras = this.newOrder.extra_charges?.reduce((sum, c) => sum + c.amount, 0) || 0;

  // El subtotal es el total menos los extras (para obtener el valor base)
  const subtotal = currentTotal; 

  // Actualizar campos
  this.newOrder.subtotal = subtotal.toString();
  this.newOrder.base_total = subtotal;
  this.newOrder.total = (subtotal + extras).toString();
  this.newOrder.amount = subtotal + extras;
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
  private stockDecisionResolver!: (proceed: boolean) => void;
  async confirmStockOverride(): Promise<boolean> {
    this.showStockWarningModal = true;

    return new Promise<boolean>((resolve) => {
      this.stockDecisionResolver = resolve;
    });
  }
  onConfirmStockOverride() {
    this.showStockWarningModal = false;
    this.stockDecisionResolver(true);
  }

  onCancelStockOverride() {
    this.showStockWarningModal = false;
    this.stockDecisionResolver(false);
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
}
