/**
 * 数据库模块 - 使用 Dexie.js 封装 IndexedDB
 *
 * 为什么选择 Dexie？
 * 1. 原生 IndexedDB API 非常繁琐（需要手动管理事务、游标等）
 * 2. Dexie 提供了类似 ORM 的链式查询 API，开发体验接近 SQL
 * 3. 完美支持 TypeScript 类型推断
 * 4. 自动处理数据库版本迁移（version().stores()）
 *
 * 数据库结构说明：
 * - words 表：存储所有文字基础数据（文字、拼音、层级路径）
 * - dictation_sessions 表：存储听写记录（计划名称、文字列表及每字听写状态）
 */

import Dexie, { type EntityTable } from 'dexie'

// ============================================================
//  类型定义
// ============================================================

/**
 * 听写状态枚举（用于听写记录中每个字的状态）
 * - new: 新词，尚未听写
 * - wrong_pinyin: 不会拼音（知道字但拼音不对）
 * - wrong_writing: 不会书写（拼音对但字写错）
 * - fuzzy: 模糊，不太确定
 * - correct: 都会，完全掌握
 */
export type WordStatus = 'new' | 'wrong_pinyin' | 'wrong_writing' | 'fuzzy' | 'correct'

/**
 * 文字实体接口（基础数据表）
 *
 * 设计思路：
 * - path 字段实现"虚拟目录"，用斜杠分隔层级（如 "一年级下册/识字表 第一单元/第一课"）
 *   这样不用建多张表就能实现树状分类，查询时用 startsWith 即可筛选子目录
 * - content 是文字内容（单个字或词语）
 * - pinyin 是拼音信息
 * - 状态改为在听写记录表（DictationSession）中记录，此处只存基础数据
 */
export interface Word {
  /** 自增主键，由 Dexie 自动管理 */
  id?: number
  /** 文字内容（如 "霜"） */
  content: string
  /** 拼音（如 "shuāng"） */
  pinyin: string
  /** 所属层级路径，用 "/" 分隔，如 "一年级下册/识字表 第一单元/第一课" */
  path: string
  /** 创建时间戳 */
  createdAt: number
}

/**
 * 听写记录中每个字的信息与状态
 *
 * 设计思路：
 * 冗余存储 content 和 pinyin，是为了即使原始 words 表数据被删除/修改，
 * 听写记录中仍然能完整展示历史结果。
 */
export interface SessionWord {
  /** 关联 words 表的 id */
  wordId: number
  /** 冗余存储文字内容，保证记录独立性 */
  content: string
  /** 冗余存储拼音 */
  pinyin: string
  /** 该字在本次听写中的状态 */
  status: WordStatus
}

/**
 * 听写记录实体接口
 *
 * 设计思路：
 * - words 数组包含每个字的信息和听写状态，words.length 即为文字数量
 * - filterPath 记录创建时的筛选条件，方便回溯
 * - status 表示整个听写记录的状态（未开始/进行中/已完成）
 * - 支持从已完成的记录中筛选特定状态的字，再次创建新记录
 */
export interface DictationSession {
  /** 自增主键 */
  id?: number
  /** 计划名称 */
  name: string
  /** 备注信息 */
  note?: string
  /** 筛选条件描述（创建时选择的层级路径） */
  filterPath: string
  /** 听写文字列表，包含每个字的信息和听写状态 */
  words: SessionWord[]
  /** 记录状态：pending-待听写, in_progress-进行中, completed-已完成 */
  status: 'pending' | 'in_progress' | 'completed'
  /** 创建时间戳 */
  createdAt: number
  /** 完成时间戳 */
  completedAt?: number
}

// ============================================================
//  数据库实例
// ============================================================

/**
 * 数据库实例
 *
 * 版本说明：
 * - v1: 初始版本，words 表含 status 字段
 * - v2: 重构版本
 *   - words 表：移除 status，新增 pinyin（pinyin 不建索引，无需按拼音查询）
 *   - 新增 dictation_sessions 表：存储听写记录
 *
 * 索引说明（stores() 中的字符串仅定义索引，非全部字段）：
 * - words: ++id 自增主键, path 按层级筛选, [path+content] 去重校验
 * - dictation_sessions: ++id 自增主键, status 按状态筛选, createdAt 按时间排序
 */
const db = new Dexie('dictation-db') as Dexie & {
  words: EntityTable<Word, 'id'>
  dictation_sessions: EntityTable<DictationSession, 'id'>
}

db.version(2).stores({
  words: '++id, path, [path+content]',
  dictation_sessions: '++id, status, createdAt',
})

export { db }
