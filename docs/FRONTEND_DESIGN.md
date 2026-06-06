# FRONTEND_DESIGN

## Design Source

Visual direction extends from the mini program asset `miniprogram/images/loading-1.jpg`. Ignored local drafts may live under root `img/`, but runtime assets belong in `miniprogram/images/`.

The image shows a warm illustrated family living room: mint sofas, cream furniture, coral gramophone, soft envelopes, sound-wave arcs, and a gentle AI heart motif. The product should feel like a family AI gramophone that helps repair expression, not a cold admin system or public social feed.

## Visual Keywords

- 奶油色背景
- 柔和粉绿配色
- 珊瑚粉 / 暖橙主按钮
- 薄荷绿辅助色
- 浅奶油卡片
- 低饱和轻插画
- 家庭客厅感
- 留声机、信封、声波、暖光 AI 助手

Avoid black-purple AI visuals, cold blue SaaS/backend styling, heavy tables, harsh borders, report/moderation cues, judgment/diagnosis metaphors, public comment-area layouts, and old class diary language.

## Global Tokens

The global WXSS tokens in `miniprogram/app.wxss` are the source of truth:

```css
page {
  --bg-main: #f6efe2;
  --bg-card: #fff8ec;
  --bg-mint: #c7ead8;
  --bg-peach: #f5b7a8;
  --text-main: #4a3b32;
  --text-muted: #8b7568;
  --brand: #df7d62;
  --brand-soft: #ffd8c9;
  --line-soft: #eadac8;
  --shadow-soft: 0 12rpx 32rpx rgba(126, 92, 72, 0.12);
  --radius-card: 24rpx;
  --radius-button: 999rpx;
}
```

Use these tokens before adding page-local colors. Page-local WXSS should not reintroduce cold slate, blue-gray dashboard backgrounds, or strong table borders.

## Components

- Primary buttons: coral/warm-orange capsule, used for main actions such as login, send, create, approve.
- Secondary buttons: cream background, soft brown border, used for navigation and optional actions.
- Cards: warm cream surface, 20-28rpx radius, soft shadow, low-contrast border.
- Tags: mint, peach, or pale blue, low saturation only.
- AI panels: mint-to-cream soft panel with copy such as “暖心表达助手” and “参考家庭沟通习惯”.
- Voice controls: use 留声 / 原声 / 试听 / 声波 language; clear states for recording, previewing, uploading, and AI processing.

## Page Rules

- Login and family selection pages may use the loading image most directly, with large cream background and warm product title.
- Join family uses the same image in a compact hero and keeps the identity form readable.
- Message list uses soft cards, not feed-like comment boxes or backend tables.
- Message creation foregrounds recording, leaving a message, AI warm expression, and the family memory switch.
- Message detail shows the optimized expression first, then authorized original content, then the expression assistant and reply composer.
- Profile and family identity pages keep forms clear, but retain warm cards, muted text, and gentle boundaries.
- Admin pages are for maintaining the family留声空间, not judging people. Use “入家申请”, “成员管理”, “停用留言”, and “隐藏留言/回复” language.

## Copy Rules

User-facing copy must use 家庭 / 留声 / 留言 / 暖心表达 / 家庭记忆 / 沟通习惯 language.

AI copy should emphasize:

- 整理表达
- 帮助说清楚
- 让家人更容易理解
- 保留真实意图和边界

Do not use copy that implies AI judges who is right, diagnoses someone, scores relationships, or labels a family member.

## Privacy And Configuration

The WeChat AppID is the project boundary `wxf73895336690e9a6` and is tracked in project configuration. Do not commit WeChat Secret, AI provider keys, GitHub tokens, local uploads, logs, or WeChat private config.
