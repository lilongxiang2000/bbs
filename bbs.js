const express      = require('express')
const cookieParser = require('cookie-parser')
const fs           = require('fs')
const svgCaptcha   = require('svg-captcha')
const md5          = require('md5')
const DB           = require('better-sqlite3')
const multer       = require('multer')

const PORT    = 8080
const app     = express()
const db      = new DB('./bbs.sqlite3')

const upload = multer({ dest: './avatars/' })

const dbMethods = {
  selectUserByName: db.prepare(
    'select * from users where username=$username'
  ),
  insertUser: db.prepare(
    'insert into users values ($username,$password,$email,$joinDate,$avatarLink,$avatarChangeDate,$mimetype)'
  ),
  updateUserAvatars: db.prepare(
    ` update users set
        avatarLink = $avatarLink,
        avatarChangeDate = $avatarChangeDate,
        mimetype = $mimetype
      where username=$username
    `
  ),
  selectPostByID: db.prepare(
    'select * from visiblePosts where id=$id'
  ),
  selectPostByName: db.prepare(
    'select * from visiblePosts where author=$author'
  ),
  /** 按时间倒序查询 n 项 */
  selectPostsReverse: db.prepare(
    'select * from visiblePosts order by createDate desc limit $n'
  ),
  insertPost: db.prepare(
    'insert into posts values ($id,$title,$content,$author,$createDate,$isDelete)'
  ),
  deletePostByID: db.prepare(
    'update posts set isDelete=1 where id=$id'
  ),
  selectCommentsByPostID: db.prepare(
    'select * from visibleComments where postID=$postID'
  ),
  selectCommentsByID: db.prepare(
    'select * from visibleComments where id=$id'
  ),
  insertComment: db.prepare(
    'insert into comments values ($id,$content,$author,$postID,$createDate,$isDelete)'
  ),
  deleteCommentByID: db.prepare(
    'update comments set isDelete=1 where id=$id'
  ),
  selectAvatarByName: db.prepare(
    'select avatarLink from users where username=$username'
  )
}

function timeLocale() {
  return new Date().toLocaleString()
}
/** Converts the characters "&", "<", ">", '"',
 * and "'" in string to their corresponding HTML entities.
 * @param {*} str
 * @returns {String}
 */
function escapeHTML(str) {
  // 防止 sxx 攻击
  str = str.toString()

  str = str.split('&').join('&amp;')
  str = str.split('<').join('&lt;')
  str = str.split('>').join('&gt;')
  str = str.split('"').join('&quot;')
  str = str.split("'").join('&#39;')

  return str
}

// 解码 url 编码请求体
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(express.static('avatars'))
app.use(cookieParser('bbs'))

// 控制台输出 请求方法 和 path
app.use((req, res, next) => {
  console.log(req.method, req.path)
  next()
})

// 防止 xss 攻击
app.post('*', (req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      let newHTML = escapeHTML(req.body[key])
      if (newHTML != req.body[key]) {
        console.warn('xss!!!', req.body[key])
        req.body[key] = newHTML
      }
    }
  }

  next()
})

// 将当前登录用户保存到 req.body.self
app.get('*', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    const user = {username: req.signedCookies.loginUser}
    req.body.self = dbMethods.selectUserByName.get(user) ?? null
  }
  next()
})

// 确保唯一会话，验证码
const sessionObjs = {}
app.use(function sessionMW(req, res, next) {
  if (!req.cookies.sessionID) {
    let sessionID = Date.now()
    res.cookie('sessionID', sessionID)
    req.cookies.sessionID = sessionID
  }

  req.session = sessionObjs[req.cookies.sessionID] ??
    (sessionObjs[req.cookies.sessionID] = {})

  next()
})


// ./
app.get('/', (req, res, next) => {
  // 按时间显示最近 10 篇帖子
  const showPosts = dbMethods.selectPostsReverse.all({n: 10})

  if (!req.body.self) res.clearCookie('loginUser')

  res.type('html').render('index.pug', {
    showPosts,
    loginUser: req.body.self,
  })

  next()
})


app.get('/captcha', (req, res, next) => {
  let captcha = svgCaptcha.create({
    color: true,
    noise: 4,
    ignoreChars: '0oOI1i'
  })
  req.session.captcha = captcha.text
  res.type('svg').end(captcha.data)

  next()
})

// user
app.get('/user/:username', (req, res, next) => {
  const user = dbMethods.selectUserByName.get(req.params)

  if (user) {
    const userPosts = dbMethods.selectPostByName.all(
      {author: user.username}
    )

    res.type('html').render('user.pug', {
      loginUser: req.body.self,
      user     : user,
      userPosts: userPosts
    })
  } else res.type('html').render('404.pug')

  next()
})


// register
app.get('/register', (req, res, next) => {
  res.type('html').render('register.pug')

  next()
})
app.post('/register', (req, res, next) => {
  const userReg = /^[a-zA-Z0-9]{3,12}$/
  const pwdReg  = /^[a-zA-Z0-9_]{8,24}$/

  if (
    userReg.test(req.body.username) &&
    pwdReg.test(req.body.password)
  ) {
    const userInfo = {
      username        : req.body.username,
      email           : req.body.email,
      password        : md5(req.body.password + md5(req.body.password.length)),
      joinDate        : timeLocale(),
      avatarLink      : '',
      avatarChangeDate: '',
      mimetype        : ''
    }

    try {
      dbMethods.insertUser.run(userInfo)
      res.type('html').render('registerErrS.pug')
    } catch (err) {
      console.log(err)
      res.type('html').render('registerErr.pug')
    }
  } else res.end('Wrong format')

  next()
})


// login
app.get('/login', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    res.redirect('/')
  } else res.type('html').render('login.pug', {
    loginErrCount: req.session.loginErrCount
  })

  next()
})
app.post('/login', (req, res, next) => {
  const loginInfo = {
    username: req.body.username,
    password: md5(
      req.body.password + md5(req.body.password.length)
    )
  }

  const captcha = req.body.captcha
    ? req.session.captcha == req.body.captcha
    : true

  const selectUser = dbMethods.selectUserByName.get(loginInfo)

  if (
    captcha && selectUser &&
    selectUser.password === loginInfo.password
  ) {
    res.cookie('loginUser', loginInfo.username, {
      maxAge: 86400000, // 一天
      signed: true,
    })
    req.session.loginErrCount = 0
    res.redirect('/')
  } else {
    req.session.loginErrCount = (req.session.loginErrCount ?? 0) + 1
    res.type('html').render('loginErr.pug', {captcha})
  }

  next()
})


// logout
app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  res.redirect('/login') // 回到主页

  next()
})


// post
app.get('/post/:id', (req, res, next) => {
  const post = dbMethods.selectPostByID.get({id: req.params.id})

  if (post) {
    const author       = dbMethods.selectUserByName.get({username: post.author})
    const thisComments = dbMethods.selectCommentsByPostID.all(
      {postID: req.params.id}
    )
    const thisCommentsAuthors = {}
    thisComments.forEach(item => {
      thisCommentsAuthors[item.author] =
        dbMethods.selectUserByName.get({
          username: item.author
        })
    })

    res.type('html').render('post.pug', {
      loginUser          : req.body.self,
      author             : author,
      post               : post,
      thisComments       : thisComments,
      thisCommentsAuthors: thisCommentsAuthors,
    })
  } else res.type('html').render('404.pug', {
    loginUser: req.body.self,
  })

  next()
})
app.delete('/post/:id', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    const post = dbMethods.selectPostByID.get({id: req.params.id})

    if (post && post.author === req.signedCookies.loginUser) {
      dbMethods.deletePostByID.run({id: req.params.id})
    }
  } else res.redirect('/login')

  next()
})
app.post('/post', (req, res, next) => {
  // 已登录用户才可发帖
  if (req.signedCookies.loginUser) {
    const postInfo = {
      id        : `${Date.now()}`,
      title     : req.body.title.slice(0, 20),
      content   : req.body.content,
      author    : req.signedCookies.loginUser,
      createDate: timeLocale(),
      isDelete  : 0
    }

    try {
      if (postInfo.title.length) {
        dbMethods.insertPost.run(postInfo)
        res.redirect(`/post/${postInfo.id}`)
      }
    } catch (err) {
      console.log('add Post', err)
    }
  }

  next()
})


// setting
app.get('/setting/:username', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    res.type('html').render('setting.pug', {
      loginUser: req.body.self,
      user: req.body.self,
    })
  } else {
    res.redirect('/login')
  }

  next()
})


// comment
app.post('/comment/:postID', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    // 防止传来 脏数据
    let commentInfo = {
      id        : `${Date.now()}`,
      content   : req.body.content,
      author    : req.signedCookies.loginUser,
      postID    : req.params.postID,
      createDate: timeLocale(),
      isDelete  : 0
    }
    if (commentInfo.content.length < 300) {
      try {
        dbMethods.insertComment.run(commentInfo)
      } catch (err) {
        console.log(err)
      }
      res.redirect(`/post/${req.params.postID}`)
    } else res.end('Comment is too long')

  } else res.redirect('/login')

  next()
})
app.delete('/comment/:commentID', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    const comment = dbMethods.selectCommentsByID.get({id: req.params.commentID})
    if (comment && comment.author == req.signedCookies.loginUser) {
      dbMethods.deleteCommentByID.run({id: comment.id})
    } else { // 判断当前评论是否在 登录用户 的帖子下
      const post = dbMethods.selectPostByID.get({id: comment.postID})
      if (post && post.author == req.signedCookies.loginUser) {
        deleteCommentByID.run({id: comment.id})
      }
    }
  } else res.redirect('/login')

  next()
})


// avatar
app.post('/avatar', upload.single('avatar'), function (req, res, next) {
  // req.file 是 `avatar` 文件的信息
  // req.body 将具有文本域数据，如果存在的话

  const userInfo = dbMethods.selectUserByName.get(req.body)
  if ( userInfo && req.file &&
    req.signedCookies.loginUser === userInfo.username
  ) {
    const oldPath  = `./avatars/${req.file.filename}`
    const filename = `${userInfo.username}.${req.file.mimetype.split('/')[1]}`
    const newPath  = `./avatars/${filename}`
    fs.rename(oldPath, newPath, function (err) {
      if (err) throw err
      console.log(`${newPath} saved`)
    })

    const data = {
      username        : userInfo.username,
      avatarLink      : filename,
      mimetype        : req.file.mimetype,
      avatarChangeDate: timeLocale(),
    }
    dbMethods.updateUserAvatars.run(data)
  }
  res.redirect(`/setting/${userInfo.username}`)

  next()
})

app.listen(PORT, () => {
  console.log('Listening on', PORT)
})
