# 基于 `express` 的论坛
基于 `Express` + `SQLite` + `Pug` 等开发一个简单论坛

# Build Setup
## 安装依赖
```bash
npm install
```
## 数据库
创建如下表结构，并将数据库文件存放在 `./bbs.sqlite3` 下
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
CREATE VIEW visiblePosts as select * from posts where isDelete=0
/* visiblePosts(id,title,content,author,createDate,isDelete) */;
CREATE VIEW visibleComments as select * from comments where isDelete=0
/* visibleComments(id,content,author,postID,createDate,isDelete) */;
```

## 运行
```bash
node bbs.js
```
