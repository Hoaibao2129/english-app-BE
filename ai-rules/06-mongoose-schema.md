---
description: Pattern Mongoose schema, index và migration dữ liệu
globs:
  - "src/**/schemas/*.ts"
  - "src/migrations/**"
---

# Mongoose schema

## Pattern
```ts
@Schema({
  collection: 'wordprogresses',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class WordProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;
}

export type WordProgressDocument = HydratedDocument<WordProgress>;
export const WordProgressSchema = SchemaFactory.createForClass(WordProgress);
WordProgressSchema.index({ user_id: 1, word_id: 1 }, { unique: true });
```

## Quy tắc
- Luôn khai `collection` rõ ràng, `versionKey: false`, timestamps snake_case.
- Mọi `@Prop` khai `type` tường minh.
- Field có thể trống: `default: null`, kiểu `T | null`.
- Khóa ngoại: `<entity>_id`, kiểu `Types.ObjectId`, có `ref`.
- Index khai báo ngay dưới schema; thêm index cho mọi query pattern chính.
- Đổi tên/xóa field đã có dữ liệu → phải viết migration trong `src/migrations/` + spec, không sửa tay DB.
- Tên collection: số nhiều, chữ thường, viết liền, không dấu gạch dưới (`wordprogresses`, `answerlogs`, `refreshtokens`).
