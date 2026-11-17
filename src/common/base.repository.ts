import {
  Model,
  ProjectionType,
  QueryFilter,
  Types,
  UpdateQuery,
} from 'mongoose';

export abstract class BaseRepository<T> {
  constructor(protected readonly model: Model<T>) {}

  /** Chuyển đổi an toàn string sang ObjectId */
  toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    return typeof id === 'string' ? new Types.ObjectId(id) : id;
  }

  /** Lấy Model gốc nếu cần dùng các tính năng nâng cao (aggregate, bulkWrite...) */
  getModel(): Model<T> {
    return this.model;
  }

  /** Tìm một document theo id, mặc định dùng lean() */
  async findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T> | null,
    options?: any,
  ): Promise<T | null> {
    return this.model
      .findById(this.toObjectId(id), projection, options)
      .lean<T | null>()
      .exec();
  }

  /** Tìm một document theo filter, mặc định dùng lean() */
  async findOne(
    filter: QueryFilter<T>,
    projection?: ProjectionType<T> | null,
    options?: any,
  ): Promise<T | null> {
    return this.model
      .findOne(filter, projection, options)
      .lean<T | null>()
      .exec();
  }

  /** Tìm danh sách document theo filter, mặc định dùng lean() */
  async find(
    filter: QueryFilter<T> = {},
    projection?: ProjectionType<T> | null,
    options?: any,
  ): Promise<T[]> {
    return this.model
      .find(filter, projection, options)
      .lean<T[]>()
      .exec();
  }

  /** Tạo mới một document */
  async create(doc: Partial<T>): Promise<T> {
    const created = await this.model.create(doc);
    return (
      typeof (created as any).toObject === 'function'
        ? (created as any).toObject()
        : created
    ) as T;
  }

  /** Update một document theo filter */
  async updateOne(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    options?: any,
  ) {
    return this.model.updateOne(filter, update, options).exec();
  }

  /** Update nhiều document theo filter */
  async updateMany(
    filter: QueryFilter<T>,
    update: UpdateQuery<T>,
    options?: any,
  ) {
    return this.model.updateMany(filter, update, options).exec();
  }

  /** Xóa một document theo filter */
  async deleteOne(filter: QueryFilter<T>) {
    return this.model.deleteOne(filter).exec();
  }

  /** Xóa nhiều document theo filter */
  async deleteMany(filter: QueryFilter<T>) {
    return this.model.deleteMany(filter).exec();
  }

  /** Đếm số lượng document theo filter */
  async countDocuments(filter: QueryFilter<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  // --- Helpers bảo đảm phân quyền người dùng (User-Scoped Isolation) ---

  async findOneForUser(
    user_id: string | Types.ObjectId,
    filter: QueryFilter<T>,
    projection?: ProjectionType<T> | null,
    options?: any,
  ): Promise<T | null> {
    const user_filter = {
      ...filter,
      user_id: this.toObjectId(user_id),
    } as QueryFilter<T>;
    return this.findOne(user_filter, projection, options);
  }

  async findForUser(
    user_id: string | Types.ObjectId,
    filter: QueryFilter<T> = {},
    projection?: ProjectionType<T> | null,
    options?: any,
  ): Promise<T[]> {
    const user_filter = {
      ...filter,
      user_id: this.toObjectId(user_id),
    } as QueryFilter<T>;
    return this.find(user_filter, projection, options);
  }

  async deleteForUser(
    user_id: string | Types.ObjectId,
    filter: QueryFilter<T> = {},
  ) {
    const user_filter = {
      ...filter,
      user_id: this.toObjectId(user_id),
    } as QueryFilter<T>;
    return this.deleteMany(user_filter);
  }
}
