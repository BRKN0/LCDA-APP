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
  imports: [FormsModule, ReactiveFormsModule, RouterOutlet],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  message: string = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly supabase: SupabaseService,
    private readonly router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
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
    const { email, password } = this.form.value;

    if (!email || !password) {
      window.alert('El email y la contraseña son requeridos');
      return;
    }
    const { error } = await this.supabase.signUpWithPassword(email, password);
    if (error) {
      window.alert('Hubo un error al registrarse, intente nuevamente');
      console.log(JSON.stringify(error, undefined, 2));
      return;
    }
    this.message =
      'Su usuario ha sido creado con éxito, revise la bandeja de entrada de su correo y abra el enlace de confirmación de correo electrónico para activar su cuenta';
  }
}
