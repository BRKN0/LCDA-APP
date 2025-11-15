import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [FormsModule, ReactiveFormsModule, RouterOutlet, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  message: string = '';
  isRegisterMode: boolean = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly supabase: SupabaseService,
    private readonly router: Router
  ) {
    this.form = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
        confirmPassword: [''],
      },
      {
        validator: this.passwordMatchValidator,
      }
    );
  }

  ngOnInit(): void {
    this.supabase.authChanges$().subscribe({
      next: (session) => {
        if (!session) return;

        this.router.navigate(['/home'], {
          queryParams: {},
          replaceUrl: true,
        });
      },
    });
  }
  goHome() {
    this.router.navigate(['/home'], {
      queryParams: {},
      replaceUrl: true,
    });
  }
  toggleMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.message = '';
    this.form.reset();
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (this.isRegisterMode && password !== confirmPassword) {
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

    const { data, error } = await this.supabase.signUpWithPassword(
      email,
      password
    );
    if (error) {
      window.alert('Hubo un error al registrarse, intente nuevamente');
      console.log(JSON.stringify(error, undefined, 2));
      return;
    }

    await this.supabase.from('users').insert([
      {
        id: data.user.id, // mismo id del auth
        email,
        user_name,
      },
    ]);

    this.message =
      'Su usuario ha sido creado con éxito, revise la bandeja de entrada de su correo y abra el enlace de confirmación de correo electrónico para activar su cuenta';

    this.toggleMode();
  }
}
