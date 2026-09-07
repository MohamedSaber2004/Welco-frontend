import type {
  CategoryDto,
  ProductDto,
  ProductMediaDto,
  CurrencyDto,
  CreateProductPayload,
  UpdateProductPayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '../models/marketplace'
import type { PaginatedResult } from '../models/location'

export interface MarketplaceQuery {
  search?: string
  sku?: string
  categoryId?: string
  page?: number
  pageSize?: number
  sortBy?: 'price-asc' | 'price-desc' | 'newest'
  inStockOnly?: boolean
  material?: string
  lengthMin?: number
  lengthMax?: number
  priceMin?: number
  priceMax?: number
  currencyId?: string
}

export interface MarketplaceRepository {
  getProducts(query?: MarketplaceQuery): Promise<PaginatedResult<ProductDto>>
  getProductById(id: string): Promise<ProductDto | null>
  getProductVideos(productId: string): Promise<ProductMediaDto[]>
  updateProductVideos(productId: string, videos: ProductMediaDto[]): Promise<ProductMediaDto[]>
  createProduct(payload: CreateProductPayload): Promise<ProductDto>
  updateProduct(id: string, payload: UpdateProductPayload): Promise<ProductDto>
  deleteProduct(id: string): Promise<void>

  getCategories(): Promise<CategoryDto[]>
  getCategoryById(id: string): Promise<CategoryDto | null>
  createCategory(payload: CreateCategoryPayload): Promise<CategoryDto>
  updateCategory(id: string, payload: UpdateCategoryPayload): Promise<CategoryDto>
  deleteCategory(id: string): Promise<void>

  getFeaturedProducts(): Promise<ProductDto[]>
  getCurrencies(): Promise<CurrencyDto[]>
}
