const Book = require("../models/book");
const Author = require("../models/author");
const Genre = require("../models/genre");
const BookInstance = require("../models/bookinstance");

const { body, validationResult } = require("express-validator");
const asyncHandler = require("express-async-handler");

// ホームページのインデックスを表示
exports.index = asyncHandler(async (req, res, next) => {
  // 本、蔵書、利用可能な蔵書、著者、ジャンルの数を並列で取得
  const [
    numBooks,
    numBookInstances,
    numAvailableBookInstances,
    numAuthors,
    numGenres,
  ] = await Promise.all([
    Book.countDocuments({}).exec(),
    BookInstance.countDocuments({}).exec(),
    BookInstance.countDocuments({ status: "Available" }).exec(),
    Author.countDocuments({}).exec(),
    Genre.countDocuments({}).exec(),
  ]);

  res.render("index", {
    title: "ローカルライブラリ ホーム",
    book_count: numBooks,
    book_instance_count: numBookInstances,
    book_instance_available_count: numAvailableBookInstances,
    author_count: numAuthors,
    genre_count: numGenres,
  });
});

// すべての本のリストを表示
exports.book_list = asyncHandler(async (req, res, next) => {
  const allBooks = await Book.find({}, "title author")
    .sort({ title: 1 })
    .populate("author")
    .exec();

  res.render("book_list", { title: "本リスト", book_list: allBooks });
});

// 特定の本の詳細ページを表示
exports.book_detail = asyncHandler(async (req, res, next) => {
  // 本とその蔵書の詳細を取得
  const [book, bookInstances] = await Promise.all([
    Book.findById(req.params.id).populate("author").populate("genre").exec(),
    BookInstance.find({ book: req.params.id }).exec(),
  ]);

  if (book === null) {
    // 結果なし
    const err = new Error("本が見つかりません");
    err.status = 404;
    return next(err);
  }

  res.render("book_detail", {
    title: book.title,
    book: book,
    book_instances: bookInstances,
  });
});

// 本作成フォームをGETで表示
exports.book_create_get = asyncHandler(async (req, res, next) => {
  // 著者とジャンルをすべて取得
  const [allAuthors, allGenres] = await Promise.all([
    Author.find().sort({ family_name: 1 }).exec(),
    Genre.find().sort({ name: 1 }).exec(),
  ]);

  res.render("book_form", {
    title: "本の作成",
    authors: allAuthors,
    genres: allGenres,
  });
});

// 本作成をPOSTで処理
exports.book_create_post = [
  // ジャンルを配列に変換
  (req, res, next) => {
    if (!Array.isArray(req.body.genre)) {
      req.body.genre =
        typeof req.body.genre === "undefined" ? [] : [req.body.genre];
    }
    next();
  },

  // フィールドのバリデーションとサニタイズ
  body("title", "タイトルは必須です。")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("author", "著者は必須です。")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("summary", "概要は必須です。")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("isbn", "ISBNは必須です").trim().isLength({ min: 1 }).escape(),
  body("genre.*").escape(),
  // バリデーション・サニタイズ後のリクエスト処理

  asyncHandler(async (req, res, next) => {
    // バリデーションエラーを抽出
    const errors = validationResult(req);

    // サニタイズ済みデータでBookオブジェクトを作成
    const book = new Book({
      title: req.body.title,
      author: req.body.author,
      summary: req.body.summary,
      isbn: req.body.isbn,
      genre: req.body.genre,
    });

    if (!errors.isEmpty()) {
      // エラーあり。フォームを再表示

      // 著者とジャンルを再取得
      const [allAuthors, allGenres] = await Promise.all([
        Author.find().sort({ family_name: 1 }).exec(),
        Genre.find().sort({ name: 1 }).exec(),
      ]);

      // 選択されたジャンルにチェックを付ける
      for (const genre of allGenres) {
        if (book.genre.indexOf(genre._id) > -1) {
          genre.checked = "true";
        }
      }
      res.render("book_form", {
        title: "本の作成",
        authors: allAuthors,
        genres: allGenres,
        book: book,
        errors: errors.array(),
      });
    } else {
      // データが有効。保存
      await book.save();
      res.redirect(book.url);
    }
  }),
];

// 本削除フォームをGETで表示
exports.book_delete_get = asyncHandler(async (req, res, next) => {
  const [book, bookInstances] = await Promise.all([
    Book.findById(req.params.id).populate("author").populate("genre").exec(),
    BookInstance.find({ book: req.params.id }).exec(),
  ]);

  if (book === null) {
    // 結果なし
    res.redirect("/catalog/books");
  }

  res.render("book_delete", {
    title: "本の削除",
    book: book,
    book_instances: bookInstances,
  });
});

// 本削除をPOSTで処理
exports.book_delete_post = asyncHandler(async (req, res, next) => {
  // idは有効と仮定（バリデーション・サニタイズなし）

  const [book, bookInstances] = await Promise.all([
    Book.findById(req.params.id).populate("author").populate("genre").exec(),
    BookInstance.find({ book: req.params.id }).exec(),
  ]);

  if (book === null) {
    // 結果なし
    res.redirect("/catalog/books");
  }

  if (bookInstances.length > 0) {
    // 蔵書が存在。GETと同じように表示
    res.render("book_delete", {
      title: "本の削除",
      book: book,
      book_instances: bookInstances,
    });
    return;
  } else {
    // 蔵書がなければ削除し、リストにリダイレクト
    await Book.findByIdAndDelete(req.body.id);
    res.redirect("/catalog/books");
  }
});

// 本更新フォームをGETで表示
exports.book_update_get = asyncHandler(async (req, res, next) => {
  // 本、著者、ジャンルを取得
  const [book, allAuthors, allGenres] = await Promise.all([
    Book.findById(req.params.id).populate("author").exec(),
    Author.find().sort({ family_name: 1 }).exec(),
    Genre.find().sort({ name: 1 }).exec(),
  ]);

  if (book === null) {
    // 結果なし
    const err = new Error("本が見つかりません");
    err.status = 404;
    return next(err);
  }

  // 選択されたジャンルにチェックを付ける
  allGenres.forEach((genre) => {
    if (book.genre.includes(genre._id)) genre.checked = "true";
  });

  res.render("book_form", {
    title: "本の更新",
    authors: allAuthors,
    genres: allGenres,
    book: book,
  });
});

// 本更新をPOSTで処理
exports.book_update_post = [
  // ジャンルを配列に変換
  (req, res, next) => {
    if (!Array.isArray(req.body.genre)) {
      req.body.genre =
        typeof req.body.genre === "undefined" ? [] : [req.body.genre];
    }
    next();
  },

  // フィールドのバリデーションとサニタイズ
  body("title", "タイトルは必須です。")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("author", "著者は必須です。")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("summary", "概要は必須です。")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("isbn", "ISBNは必須です").trim().isLength({ min: 1 }).escape(),
  body("genre.*").escape(),

  // バリデーション・サニタイズ後のリクエスト処理
  asyncHandler(async (req, res, next) => {
    // バリデーションエラーを抽出
    const errors = validationResult(req);

    // サニタイズ済みデータと古いidでBookオブジェクトを作成
    const book = new Book({
      title: req.body.title,
      author: req.body.author,
      summary: req.body.summary,
      isbn: req.body.isbn,
      genre: typeof req.body.genre === "undefined" ? [] : req.body.genre,
      _id: req.params.id, // これが必要。新しいIDが割り当てられるのを防ぐ
    });

    if (!errors.isEmpty()) {
      // エラーあり。フォームを再表示

      // 著者とジャンルを再取得
      const [allAuthors, allGenres] = await Promise.all([
        Author.find().sort({ family_name: 1 }).exec(),
        Genre.find().sort({ name: 1 }).exec(),
      ]);

      // 選択されたジャンルにチェックを付ける
      for (const genre of allGenres) {
        if (book.genre.includes(genre._id)) {
          genre.checked = "true";
        }
      }
      res.render("book_form", {
        title: "本の更新",
        authors: allAuthors,
        genres: allGenres,
        book: book,
        errors: errors.array(),
      });
      return;
    } else {
      // データが有効。レコードを更新
      const thebook = await Book.findByIdAndUpdate(req.params.id, book, {});
      // 詳細ページにリダイレクト
      res.redirect(thebook.url);
    }
  }),
];
