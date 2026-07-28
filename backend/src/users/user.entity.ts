import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'ADMIN' | 'PLAYER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({
    name: 'member_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  memberCode: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  @Column({ name: 'google_id', type: 'varchar', length: 255, nullable: true })
  googleId: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'role', type: 'varchar', length: 20, default: 'PLAYER' })
  role: UserRole;

  @Column({
    name: 'user_status',
    type: 'varchar',
    length: 20,
    default: 'ACTIVE',
  })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
