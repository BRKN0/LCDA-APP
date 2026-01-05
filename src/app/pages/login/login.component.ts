import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [FormsModule, ReactiveFormsModule, RouterOutlet, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  form: FormGroup;
  message: string = '';
  isRegisterMode: boolean = false;
  isRecoveryMode: boolean = false;
  isResetPasswordMode: boolean = false;
  private authSubscription: Subscription | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly supabase: SupabaseService,
    private readonly router: Router
  ) {
    this.form = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
        user_name: [''],
        confirmPassword: [''],
      },
      {
        validator: this.passwordMatchValidator,
      }
    );
  }

  ngOnInit(): void {
    // Primero verificar el hash ANTES de subscribirse
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    if (type === 'recovery' && accessToken) {
      // Flujo de recuperación
      this.isResetPasswordMode = true;
      this.isRecoveryMode = false;
      this.isRegisterMode = false;
      this.message = 'Por favor, ingresa tu nueva contraseña';

      // Suscribirse pero sin redirigir
      this.authSubscription = this.supabase.authChanges$().subscribe({
        next: (session) => {
          if (session && !this.isResetPasswordMode) {
            this.router.navigate(['/home'], {
              queryParams: {},
              replaceUrl: true,
            });
          }
        },
      });
      return;
    }

    // Flujo normal
    this.authSubscription = this.supabase.authChanges$().subscribe({
      next: (session) => {
        if (!session) return;

        this.router.navigate(['/home'], {
          queryParams: {},
          replaceUrl: true,
        });
      },
    });
  }
  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
  goHome() {
    this.router.navigate(['/home'], {
      queryParams: {},
      replaceUrl: true,
    });
  }
  toggleMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.isRecoveryMode = false;
    this.isResetPasswordMode = false;
    this.message = '';
    this.form.reset();
  }

  toggleRecoveryMode() {
    this.isRecoveryMode = !this.isRecoveryMode;
    this.isRegisterMode = false;
    this.isResetPasswordMode = false;
    this.message = '';
    this.form.reset();
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (
      (this.isRegisterMode || this.isResetPasswordMode) &&
      password !== confirmPassword
    ) {
      return { passwordMismatch: true };
    }
    return null;
  }

  async login() {
    this.message = '';
    const { email, password } = this.form.value;

    if (!email || !password) {
      window.alert('El email y la contraseña son requeridos');
      return;
    }

    const { error } = await this.supabase.signInWithPassword(email, password);

    if (error) {
      switch (error.code) {
        case 'email_not_confirmed':
          window.alert(
            'Su correo electrónico no está confirmado, por favor abra el enlace de activación enviado a su bandeja de entrada o inicie el proceso de recuperación de contraseña'
          );
          break;
        default:
          window.alert('Credenciales incorrectas, intente nuevamente');
          break;
      }
      console.error(error);
    }
  }

  async signUp() {
    this.message = '';
    const { email, password, user_name } = this.form.value;

    if (!email || !password || !user_name) {
      window.alert('Todos los campos son requeridos para registrarse');
      return;
    }
    if (this.form.hasError('passwordMismatch')) {
      window.alert('Las contraseñas no coinciden');
      return;
    }

    const { error } = await this.supabase.signUpWithPassword(
      email,
      password,
      user_name
    );
    if (error) {
      window.alert('Hubo un error al registrarse, intente nuevamente');
      console.log(JSON.stringify(error, undefined, 2));
      return;
    }

    this.message =
      'Su usuario ha sido creado con éxito, revise la bandeja de entrada de su correo y abra el enlace de confirmación de correo electrónico para activar su cuenta';

    this.toggleMode();
  }

  async sendRecoveryEmail() {
    this.message = '';
    const { email } = this.form.value;

    if (!email) {
      window.alert('El email es requerido');
      return;
    }

    const { error } = await this.supabase.resetPasswordForEmail(email);

    if (error) {
      window.alert('Hubo un error al enviar el correo de recuperación');
      console.error(error);
      return;
    }

    this.message =
      'Se ha enviado un correo de recuperación a su bandeja de entrada. Por favor revise su correo y siga las instrucciones para restablecer su contraseña.';
  }

  async updatePassword() {
    this.message = '';
    const { password, confirmPassword } = this.form.value;

    if (!password || !confirmPassword) {
      window.alert('Debes completar ambos campos de contraseña');
      return;
    }

    if (password !== confirmPassword) {
      window.alert('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      window.alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    const { error } = await this.supabase.updateUser({
      password: password,
    });

    if (error) {
      window.alert('Error al actualizar la contraseña: ' + error.message);
      console.error(error);
      return;
    }

    window.alert('¡Contraseña actualizada exitosamente!');

    // Limpiar el hash de la URL y resetear estados
    window.history.replaceState({}, document.title, window.location.pathname);
    this.isResetPasswordMode = false;
    this.form.reset();

    this.router.navigate(['/home'], {
      replaceUrl: true,
    });
  }
}
