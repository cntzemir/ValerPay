import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

export class LoginDto {
  email!: string;
  password!: string;
}

export class RegisterDto {
  email!: string;
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('user/register')
  async registerUser(@Body() body: RegisterDto) {
    return this.auth.registerUser(body);
  }

  @Post('user/login')
  async loginUser(@Body() body: LoginDto) {
    return this.auth.loginUser(body);
  }

  @Post('admin/login')
  async loginAdmin(@Body() body: LoginDto) {
    return this.auth.loginAdmin(body);
  }
}
