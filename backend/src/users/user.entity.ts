import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'ADMIN' | 'PLAYER';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'email', type: 'nvarchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'full_name', type: 'nvarchar', length: 255 })
  fullName: string;

  @Column({
    name: 'password_hash',
    type: 'nvarchar',
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  @Column({ name: 'google_id', type: 'nvarchar', length: 255, nullable: true })
  googleId: string | null;

  @Column({ name: 'avatar_url', type: 'nvarchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'role', type: 'nvarchar', length: 20, default: 'PLAYER' })
  role: UserRole;

  @CreateDateColumn({ name: 'created_at', type: 'datetime2' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime2' })
  updatedAt: Date;
}
