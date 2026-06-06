# 暖心留声机

家庭 AI 留声机微信小程序。它帮助家庭成员用文字和语音留下心声，并通过 AI 将不清晰、情绪化或不好开口的话整理成更温和、更准确、更容易被家人理解的表达。

## Product Direction

- AI 是家庭沟通翻译器，不是裁判。
- 优化表达，但不抹掉真实情绪。
- 保留原话和原始语音，由发送者控制接收方是否可以查看或播放。
- 默认保护家庭隐私，家庭外成员不能访问家庭内容。

## Current State

当前代码来自一个班级日记本小程序，技术栈为：

- 微信原生小程序
- Node.js + Express
- Prisma + MySQL 8.0
- JWT
- Docker Compose

后续重构会复用登录、成员审核、通知、举报、上传、软删除和权限校验等基础能力，将业务语义迁移为家庭空间、心声留言和 AI 回复辅助。

## Key Docs

- `AGENTS.md`: Codex/开发代理约束。
- `docs/PRODUCT_REQUIREMENTS.md`: 产品需求。
- `docs/AI_CONSTRAINTS.md`: AI 接入、输出和安全约束。
- `docs/API_SPEC.md`: API 目标规格。
- `docs/DATABASE_SCHEMA.md`: 数据库目标模型。
- `docs/UX_FLOW.md`: 小程序目标流程。
- `docs/PERMISSION_MODEL.md`: 权限和隐私规则。
- `docs/IMPLEMENTATION_PLAN.md`: 重构实施计划。
- `docs/TEST_PLAN.md`: 验收测试计划。
