# 基于 Express 的论坛
基于 `Express` + `SQLite` + `Pug` 等开发一个简单论坛

# 功能列表
- 发帖、删贴
- 评论、删除评论
- 登录（验证码验证）、注册
- 头像上传

# 界面展示
## 主页
![home](https://s2.loli.net/2022/07/06/nAbuCU8vmEwyH3L.png)

## 帖子页面
![post](https://s2.loli.net/2022/07/06/8rtBTIp2EsyQHZR.png)

## 用户界面
![user](https://s2.loli.net/2022/07/06/ecs17Cf62zQd9aM.png)

## 登录、注册
![login](https://s2.loli.net/2022/07/06/9Joc8g4Hz6pKW5T.png)
![register](https://s2.loli.net/2022/07/06/IzKbrJDncafYgH2.png)

# 技术栈
## 前端
- ES6：
- Bootstrap：前端样式框架
## 后端
- Express：基于Node.js平台的Web开发框架，本项目使用Express进行后端的开发


# Build Setup
## 安装依赖
```bash
npm install
```
## 数据库
创建如下表结构，将数据库文件存放在 `./bbs.sqlite3` 下
```SQL
CREATE TABLE users(
  username text primary key,
  password text not null,
  email text not null unique,
  joinDate text not null,
  avatarLink text,
  avatarChangeDate text,
  mimetype text
);
CREATE TABLE posts(
  id text primary key,
  title text not null,
  content text not null,
  author text not null,
  createDate text not null,
  isDelete integer not null
);
CREATE TABLE comments(
  id text primary key,
  content text not null,
  author text not null,
  postID text not null,
  createDate text not null,
  isDelete integer not null
);
CREATE VIEW visiblePosts as select * from posts where isDelete=0;
/* visiblePosts(id,title,content,author,createDate,isDelete) */
CREATE VIEW visibleComments as select * from comments where isDelete=0;
/* visibleComments(id,content,author,postID,createDate,isDelete) */
```

## 运行
```bash
node bbs.js
# http://127.0.0.1:8080
```
