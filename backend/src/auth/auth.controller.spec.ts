import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            getGoogleLoginUrl: jest.fn(),
            handleGoogleCallback: jest.fn(),
            completeFirstLogin: jest.fn(),
            verifyForgotPasswordEmail: jest.fn(),
            resetPassword: jest.fn(),
            changePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('does not reveal whether an email address has an account', () => {
    expect(controller.forgotPassword()).toEqual({
      message: 'Contact your tournament administrator to reset your password.',
    });
  });
});
