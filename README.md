# english-input-coach

一个把真实语言输入转成结构化学习环节的 agent skill。

它不是背单词软件，不是课程平台，也不是一套“大而全”的语言学习系统。  
它更像一份交给 agent 的工作说明书：当你已经看过、听过、读过一段目标语言内容时，agent 不要只给你查词和总结，而要基于这份真实输入带你学、带你练、再接住你的错误。

## 为什么做这个

我一直在探索一件事：能不能围绕自己真正喜欢的内容学语言，而不是把学习过程变成一种很难受的任务管理。

我不太喜欢很多传统路径里这些体验：

- 学的不是自己真的会看的东西
- 只会积累词表，不会把输入变成可复用表达
- 讲解很多，但练习很弱
- 做完一轮就结束，接不住后续纠错和能力变化

我现在主要在用这套方法学英语，也会关注日语，后面也可能扩展到别的语言。  
我自己的情况不是零基础起步，而是已经有一定输入量，瓶颈更多在“怎么继续往上提、怎么让真实输入变成稳定输出”。

所以这个 skill 的目标不是“替代老师”，而是把一部分“备课、组织材料、出练习、纠错、总结本轮问题”的工作交给 agent。

## 它适合谁

更适合：

- 已经有一定目标语言基础的人
- 平时就有真实输入来源的人
- 愿意围绕字幕、文章、视频内容做语境化训练的人
- 不想只做题海、只背词表的人

目前不太适合：

- 完全零基础新手
- 还没法靠输入大致跟上内容的人
- 主要目标是标准化考试模板训练的人

## 输入怎么来

当前最自然的输入来源是你本来就在看的内容，比如：

- 英语视频
  - 例如英区 Vtuber 录播
  - YouTube 闲聊视频
  - 历史、评论、讲解类视频
- 英文文章
  - 博客
  - 长帖
  - 评论文
  - 解释型文章

如果是视频，我当前的实践路径一般是：

1. 用 [yt-dlp](https://github.com/yt-dlp/yt-dlp) 下载字幕
2. 拿到 `.srt` 文件
3. 直接把全文或高价值片段喂给 agent

例如：

```bash
yt-dlp --write-subs --write-auto-subs --sub-langs en --skip-download <video-url>
```

拿到 `.srt` 后，可以：

- 直接把内容贴给 agent
- 先手动截取一段你觉得最值得学的片段再喂

## 这个 skill 做什么

它的核心不是“解释这段英语”，而是把输入组织成一轮可执行的学习流程。

每轮固定产出 6 段：

1. `Scene Capsule`
2. `High-Value Chunks / Vocab`
3. `Comprehension Check`
4. `Error-Prone Rewrite`
5. `Contextual Output`
6. `Profile Delta + Review Candidates`

也就是说，agent 不是只给你：

- 摘要
- 生词表
- 泛泛讲解

而是要继续负责：

- 把场景讲清楚
- 挑出真正值得复用的表达
- 设计理解检查和纠错改写
- 逼你在原语境里输出
- 总结这轮暴露出的能力增量

## 当前支持的输入分轨

### `live_chat`

适合：

- VTuber 直播
- YouTube / Twitch 闲聊段落
- 口语字幕
- 高互动、强语气、话题跳跃快的转写文本

重点训练：

- 口语理解
- 高复用语块
- 语气和互动意图
- 场景化口语输出

### `article_reading`

适合：

- 英文文章
- 博客
- 评论文
- 解释型文本

重点训练：

- 论点理解
- 关键词汇的语境义
- 改写精度
- 总结与立场表达

## 方法学立场

这个项目的一个基本判断是：

- 学习效果很依赖材料有没有被好好组织
- skill 的作用，是把方法论和流程固定下来
- agent 的作用，是基于你这次输入去理解、备课、讲解、出题、纠错

两者结合起来，更像一个会针对你当下材料实时备课的老师，而不是一份死的课程。

这里的“科学依据”不是为了把 README 写得像论文，而是为了约束结构不要乱来。当前参考的方向包括：

- retrieval practice
- spacing
- noticing
- output hypothesis
- formulaic sequences

具体说明在 [references/pedagogy.md](references/pedagogy.md)。

这份 skill 是 **research-informed**，不是 **research-proven**。  
它不声称这就是语言学习的最优模板，只是一个有明确方法论约束、可以持续迭代的工作流草稿。

## 最小输入合同

至少提供：

```json
{
  "input_type": "transcript",
  "track": "live_chat",
  "title": "VTuber opening segment",
  "text": "English text here"
}
```

可选字段：

```json
{
  "learner_language": "zh-CN",
  "source_url": "https://example.com/video",
  "creator_or_channel": "Example Channel",
  "watched_or_read": true
}
```

## 使用方式

### 1. 用直播字幕生成一轮 lesson

```text
Use the english-input-coach skill.

input_type: transcript
track: live_chat
title: VTuber opening segment
text:
[粘贴字幕或节选]

请基于这份输入给我生成完整 lesson，保留六个固定部分。
```

### 2. 用文章生成一轮 lesson

```text
Use the english-input-coach skill.

input_type: article
track: article_reading
title: Remote work article
text:
[粘贴文章或节选]

请用中文给中文母语者生成一轮 lesson。
```

### 3. 做完练习后继续纠错

```text
Use the english-input-coach skill.

这是我对上一轮 rewrite 和 contextual output 的回答：
[粘贴回答]

请直接纠错，并更新 Profile Delta + Review Candidates。
```

## 当前状态

**这是草稿版本。**

目前已经有：

- `SKILL.md` 主流程
- 两条输入分轨
- 固定 lesson 输出合同
- 研究依据与验证 rubric
- 面向公开仓库的基础文档

目前还**没有经过充分测试**：

- 不同长度字幕上的稳定性
- 不同文章风格上的泛化效果
- 多轮纠错后的 `Profile Delta` 复用价值
- 公开给其他人使用时的提示词兼容性

所以更准确地说，这个仓库当前是一个 **可用但仍在实验中的 v1 草稿**。

## 仓库结构

```text
english-input-coach/
|-- SKILL.md
|-- README.md
|-- agents/
|   `-- openai.yaml
`-- references/
    |-- input-contract.md
    |-- pedagogy.md
    |-- profile-schema.md
    |-- track-article-reading.md
    |-- track-live-chat.md
    `-- validation-rubric.md
```

## 发布和迭代

这个仓库的发布单位就是 skill 本体，不依赖我本地的其它实验目录。

欢迎：

- issue 反馈你的使用体验
- 提交失败案例
- 提出你觉得值得加入的 lesson 结构或验证方式

也欢迎 PR。  
但我会比较严格地审查改动，尤其关注：

- 是否真的提高了效果
- 是否引入副作用
- 是否破坏了原有使用体验

现阶段，这个项目更适合边用边改，而不是先把结构设计到过度复杂。
