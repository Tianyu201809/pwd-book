# PwdBook 本地账号设计

## 1. 背景与目标

PwdBook 今天是一台电脑上的一个保险库：`{userData}/pwdbook.db` 加上同目录的附件和同步文件，一把主密码，内存里一把会话密钥。

本设计增加本机账号。账号是本地维护的命名保险库，不连接服务器，也不做远程登录。每个账号有自己的主密码。用户在同一台电脑上切换账号，看到的是该账号自己的密码库。

成功标准：

- 已有数据成为第一个账号，主密码不变，条目、附件、便签、剪切板历史和同步配置都还在。
- 可以再建一个账号。不输入它的主密码就读不到它的内容，也读不到其他账号的内容。
- 切换后，快捷条、剪切板小窗、详情窗和便签窗不再显示上一个账号的内容。
- 语言、主题、全局快捷键、开机启动和关窗行为在账号之间保持不变。

## 2. 范围

### 2.1 本次要做

- 账号名单、新建、改名、切换、删除。
- 每个账号一个独立目录，内含自己的数据库、附件和同步文件。
- 本机共用设置从账号库中拆出。
- 升级时把现有库迁成第一个账号。
- 锁定界面按所选账号解锁、恢复和清空。
- 切换时收起会显示机密的窗口，并停掉上一个账号的同步。

### 2.2 不做

- 服务器账号、云端登录、账号名单同步。
- 多个账号共用一把主密码。
- 先输入账号口令、再输入保险库主密码的两层口令。
- 为了切换账号而重启应用。
- 把所有账号放进同一个 `pwdbook.db`。
- 把一个账号的条目复制或合并到另一个账号。
- 生物识别解锁。现有恢复密钥、重置主密码和清除保险库仍只作用于当前选中的账号。

## 3. 存储与会话

用户数据目录变成：

```text
{userData}/
  machine.json
  native-host/
  native-bridge.json
  accounts/{accountId}/
    pwdbook.db
    attachments/
    sync-server/
    wifi-sync-certs/
```

`native-host/` 和 `native-bridge.json` 留在本机根目录。浏览器只注册一个本机宿主，填充哪个库由当前解锁的账号决定。

`machine.json` 是账号名单和本机设置，锁定前就要能读，因此显示名是明文。里面没有主密码、盐、哈希或会话密钥。

```json
{
  "version": 1,
  "activeAccountId": "uuid",
  "accounts": [
    { "id": "uuid", "name": "默认账号", "createdAt": 0 }
  ],
  "settings": {
    "uiLocale": "zh-CN",
    "launchAtLoginEnabled": false,
    "closeWindowAction": "ask",
    "quickBarEnabled": true,
    "quickBarAccelerator": "Alt+Shift+P",
    "mainWindowShortcutEnabled": true,
    "mainWindowShortcutAccelerator": "Alt+Shift+M",
    "notesManagerShortcutEnabled": true,
    "notesManagerAccelerator": "Alt+Shift+N",
    "clipboardAccelerator": "Alt+Shift+O",
    "browserExtensionId": ""
  }
}
```

主题、皮肤和强调色继续留在渲染进程现有的 `localStorage`，本来就是整台应用一份。

从账号库的 `app_settings` 搬进 `machine.json` 后，从该账号库删除这些键：

- `ui_locale`
- `launch_at_login_enabled`
- `close_window_action`
- `quick_bar_enabled`
- `quick_bar_accelerator`
- `main_window_shortcut_enabled`
- `main_window_shortcut_accelerator`
- `notes_manager_shortcut_enabled`
- `notes_manager_accelerator`
- `clipboard_accelerator`
- `browser_extension_id`
- `auto_update_enabled`（旧库里有才搬）

仍留在该账号的 `pwdbook.db`：主密码与恢复密钥、密码条目、附件索引、便签、分类、回收站、剪切板历史，以及剪切板行为（`clipboard_enabled`、`clipboard_default_expiry`、`clipboard_persistence`、`clipboard_history_limit`、`clipboard_quick_mode`、`clipboard_clear_enabled`、`clipboard_clear_seconds`）、`auto_lock_minutes`、`trash_retention_days`、`browser_fill_enabled`、`quick_bar_recent_ids`、`quick_bar_recent_limit`、分类顺序、同步配置和同步修订。

同一时刻只打开 `activeAccountId` 对应的数据库。内存里只有一把会话密钥，并且记下它属于哪个账号。其他账号的文件保持关闭，不以这把密钥解密。

读取语言、快捷键、开机启动、关窗行为和扩展 ID 时只读 `machine.json`。读取自动锁定、剪切板行为和浏览器填充开关时只读当前账号库。

## 4. 账号生命周期

显示名去掉首尾空白后必须非空，最长 32 个 Unicode 码位，并且与已有显示名完全相同则拒绝。比较区分大小写。

### 4.1 锁定界面

还没有任何账号时，锁定界面是「新建账号」：显示名、主密码、确认主密码。主密码规则沿用现在的校验：至少 4 位，两次输入一致。创建成功后进入现在的恢复密钥展示，然后进入这个空库。

已有账号时：

- 列出全部显示名，预先选中 `activeAccountId`。
- 主密码只解锁当前选中的账号。
- 「新建账号」不需要先解锁其他账号，新库是空的。
- 选中另一个账号时，先把 `activeAccountId` 写成这个账号，再关闭当前库并打开它的库。会话仍保持锁定。恢复密钥、重置主密码和清除保险库都作用在这个选中的账号上。

### 4.2 解锁之后

设置中增加账号区：当前显示名、改名、切换账号、删除账号。改名只改 `machine.json` 里的显示名，不要求再输入主密码，仍受 4.1 的名称规则约束。

标题栏显示当前账号名。点击后立刻锁定，回到账号列表，并预先选中刚离开的账号。

删除只出现在已解锁账号的设置里。用户要再输入一次该账号的主密码。密码正确后：

1. 锁定会话并关闭数据库。
2. 把 `accounts/{id}` 改名为 `accounts/{id}.deleting`。
3. 从 `machine.json` 去掉该账号，并把 `activeAccountId` 改成名单里排在最前面的剩余账号。
4. 删除 `accounts/{id}.deleting`。

只剩一个账号时不能删除。清空这个最后账号的数据走现有的「清除保险库」：账号记录和显示名保留，该账号的库、附件、便签、剪切板和同步数据被清掉，主密码设置被清掉，锁定界面回到这个账号的「创建主密码」。

## 5. 切换时的窗口、剪切板和填充

从已解锁状态切换账号，沿用现有锁定顺序，并补上账号边界：

1. 先把便签草稿写回正在离开的账号。
2. 隐藏快捷条、剪切板小窗和详情窗，销毁便签窗。
3. 若系统剪贴板里的文本仍等于本应用最近一次复制的机密，立刻清除。用户自己复制的其他内容保留。
4. 停止当前账号的 Wi-Fi 同步服务和文件夹监听。
5. 清除会话密钥并关闭数据库。
6. 回到锁定界面。

便签窗的「锁定前可见」记忆只属于被锁定的那个账号。再次解锁同一个账号时，按现在的方式恢复这些窗口。解锁的是另一个账号时，丢掉这份记忆，只打开那个账号自己标记为桌面显示的便签。

快捷条里的最近条目来自当前账号库。浏览器填充在锁定期间返回未解锁；解锁后只查询当前打开的库。Wi-Fi 同步和文件夹同步只在该账号解锁之后，按该账号自己的配置恢复。

## 6. 升级迁移

`machine.json` 最后写入。它写成功之前，下次启动仍按未完成迁移处理。搬迁使用同一卷上的重命名。任一步重命名失败时，不写 `machine.json`，已留下的新路径在下次启动继续处理。

启动顺序：

1. `machine.json` 存在且能解析：按它打开 `activeAccountId`。名单里的目录缺失时，进入第 7 节的损坏状态，不另选一个账号顶上。
2. `machine.json` 存在但不能解析：改名为 `machine.json.corrupt-{timestamp}`。此时若 `accounts/` 下已有库文件，停在错误页，说明名单文件已损坏、库目录还在，不创建新账号，也不删除这些目录。若没有任何库目录，进入全新安装。
3. 没有 `machine.json`，但根目录有旧的 `pwdbook.db`：执行迁移。
4. 没有 `machine.json`、没有旧库，且 `accounts/` 下恰好有一个尚未登记的 `pwdbook.db`：把它登记为「默认账号」。这覆盖迁移写完文件、尚未写名单就退出的情况。
5. 没有 `machine.json`、没有旧库，且未登记的库不止一个：停在错误页，不挑其中一个。
6. 都没有：全新安装，进入「新建账号」。

迁移一个有效旧库时：

1. 生成新的账号 id。
2. 把 `pwdbook.db`、`attachments/`、`sync-server/`、`wifi-sync-certs/` 移入 `accounts/{id}/`。后三个目录不存在就跳过。`native-host/` 和 `native-bridge.json` 不动。
3. 打开移入后的库，把第 3 节列出的本机键抄进内存，再从账号库删除这些键并落盘。
4. 最后写 `machine.json`：显示名固定为「默认账号」，`activeAccountId` 为这个 id，本机设置使用刚抄出的值；某个键旧库里没有时用现在的应用默认值。

旧 `pwdbook.db` 不是有效 SQLite 文件时，沿用现在的隔离：改名为根目录下的 `pwdbook.db.corrupt-{timestamp}`，然后按全新安装进入「新建账号」。不给损坏文件创建一个看起来迁移成功的账号。

迁移后的账号若已有主密码，锁定界面是解锁，不是重新创建。文件夹同步的目标路径存在账号库的设置里，随库一起搬走。

## 7. 失败处理

- 主密码错误：停留在当前选中的账号，不解锁，不改 `activeAccountId`。
- 新建账号：名称和主密码先校验。校验失败时不建目录。建目录或初始化库失败时，删掉这个新目录，不写入名单，原来的活动账号保持不变。
- 删除账号：主密码错误或这是最后一个账号时不删除。第 4.2 节的改名已经完成但目录还在 `accounts/{id}.deleting` 时，下次启动删掉该残留目录。名单仍指向旧 id、而目录已经在 `.deleting` 时，把目录改回 `accounts/{id}` 并提示删除未完成。
- 选中账号的 `pwdbook.db` 缺失，或文件头不是 SQLite：把坏文件留在该账号目录并加上 `.corrupt-{timestamp}` 后缀。不创建替身空库，不改打开另一个账号。锁定界面说明这个账号的库已损坏、原文件还在。用户可以改选其他账号；只有明确选择「为该账号重建空库」时，才创建新的空库并进入该账号的「创建主密码」。
- 恢复密钥错误、重置主密码和清除保险库只读写当前打开的那一个账号目录。
- `machine.json` 能解析，但 `activeAccountId` 不在名单中：停在错误页，不隔离这份文件，不另选账号，也不删除已有目录。

## 8. 验收

- 升级：旧库、附件、`sync-server/`、`wifi-sync-certs/` 进入同一个账号目录；锁定界面显示「默认账号」；原主密码能解锁；本机键已从账号库消失并能从 `machine.json` 读到；第二次启动不再迁移。
- 中断：库文件已经移入 `accounts/{id}/` 但没有 `machine.json` 时，下次启动登记为「默认账号」。旧库文件头损坏时被隔离，并出现「新建账号」。
- 隔离：新建第二个账号后库是空的。解锁第二个账号时看不到第一个账号的条目、便签、剪切板历史和同步配置。错误主密码不能解锁。
- 切换：草稿已写回原账号；快捷条、剪切板小窗、详情窗、便签窗不再显示原账号内容；应用刚复制的机密已从系统剪贴板清掉；Wi-Fi 同步和文件夹监听已停止。再解锁原账号时恢复它锁定前的便签窗；解锁另一个账号时只打开那个账号自己的桌面便签。
- 本机设置：切换前后语言、主题、全局快捷键、开机启动和关窗行为不变。自动锁定分钟数、剪切板保留策略和浏览器填充开关可以按账号不同。
- 删除：错误主密码不会删除；最后一个账号不能删除；删除后该目录消失，另一个账号的库仍能用自己的主密码打开。清除最后一个账号后，显示名还在，需要重新创建主密码。
- 损坏名单：无法解析的 `machine.json` 被隔离；已有账号目录还在；应用不进入一个新的空库。
