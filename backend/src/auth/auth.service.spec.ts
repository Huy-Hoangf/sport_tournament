import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { DEFAULT_PLAYER_PASSWORD } from './auth.constants';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    updatePassword: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      updatePassword: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('issues a temporary token when a player uses the default password', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 7,
      email: 'player@twenty-tech.com',
      fullName: 'First Player',
      role: 'PLAYER',
      passwordHash: await bcrypt.hash(DEFAULT_PLAYER_PASSWORD, 10),
    });
    jwtService.signAsync.mockResolvedValue('temporary-token');

    const result = await service.login(
      'player@twenty-tech.com',
      DEFAULT_PLAYER_PASSWORD,
    );

    expect(result.requiresPasswordChange).toBe(true);
    expect(result.accessToken).toBe('temporary-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 7,
        role: 'PLAYER',
        purpose: 'PASSWORD_CHANGE',
      }),
      { expiresIn: '15m' },
    );
  });

  it('changes the default password before issuing a full access token', async () => {
    const player = {
      id: 7,
      email: 'player@twenty-tech.com',
      fullName: 'First Player',
      role: 'PLAYER' as const,
      passwordHash: await bcrypt.hash(DEFAULT_PLAYER_PASSWORD, 10),
    };
    jwtService.verifyAsync.mockResolvedValue({
      sub: player.id,
      email: player.email,
      role: player.role,
      purpose: 'PASSWORD_CHANGE',
    });
    usersService.findByEmail.mockResolvedValue(player);
    usersService.updatePassword.mockResolvedValue(player);
    jwtService.signAsync.mockResolvedValue('full-access-token');

    const result = await service.completeFirstLogin(
      'Bearer temporary-token',
      'new-secure-password',
    );

    expect(usersService.updatePassword).toHaveBeenCalledWith(
      player.email,
      'new-secure-password',
    );
    expect(result.accessToken).toBe('full-access-token');
    expect(jwtService.signAsync).toHaveBeenLastCalledWith({
      sub: player.id,
      email: player.email,
      role: player.role,
    });
  });
});
