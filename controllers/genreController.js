const Genre = require("../models/genre");
const Book = require("../models/book");

const { body, validationResult } = require("express-validator");
const asyncHandler = require("express-async-handler");

// すべてのジャンルのリストを表示
exports.genre_list = asyncHandler(async (req, res, next) => {
  const allGenres = await Genre.find().sort({ name: 1 }).exec();
  res.render("genre_list", {
    title: "ジャンル一覧",
    list_genres: allGenres,
  });
});

// 特定のジャンルの詳細ページを表示
exports.genre_detail = asyncHandler(async (req, res, next) => {
  // ジャンルの詳細と関連するすべての本を（並列で）取得
  const [genre, booksInGenre] = await Promise.all([
    Genre.findById(req.params.id).exec(),
    Book.find({ genre: req.params.id }, "title summary").exec(),
  ]);
  if (genre === null) {
    // 結果なし
    const err = new Error("ジャンルが見つかりません");
    err.status = 404;
    return next(err);
  }

  res.render("genre_detail", {
    title: "ジャンル詳細",
    genre: genre,
    genre_books: booksInGenre,
  });
});

// ジャンル作成フォーム（GET）を表示
exports.genre_create_get = (req, res, next) => {
  res.render("genre_form", { title: "ジャンル作成" });
};

// ジャンル作成処理（POST）
exports.genre_create_post = [
  // nameフィールドのバリデーションとサニタイズ
  body("name", "ジャンル名は3文字以上で入力してください")
    .trim()
    .isLength({ min: 3 })
    .escape(),

  // バリデーションとサニタイズ後のリクエスト処理
  asyncHandler(async (req, res, next) => {
    // バリデーションエラーを抽出
    const errors = validationResult(req);

    // エスケープ・トリム済みデータでジャンルオブジェクトを作成
    const genre = new Genre({ name: req.body.name });

    if (!errors.isEmpty()) {
      // エラーあり。フォームを再表示
      res.render("genre_form", {
        title: "ジャンル作成",
        genre: genre,
        errors: errors.array(),
      });
      return;
    } else {
      // フォームデータは有効
      // 同名（大文字小文字区別なし）のジャンルが既に存在するか確認
      const genreExists = await Genre.findOne({ name: req.body.name })
        .collation({ locale: "en", strength: 2 })
        .exec();
      if (genreExists) {
        // 既存ジャンルがあれば詳細ページへリダイレクト
        res.redirect(genreExists.url);
      } else {
        await genre.save();
        // 新規ジャンル保存後、詳細ページへリダイレクト
        res.redirect(genre.url);
      }
    }
  }),
];

// ジャンル削除フォーム（GET）を表示
exports.genre_delete_get = asyncHandler(async (req, res, next) => {
  // ジャンルの詳細と関連するすべての本を（並列で）取得
  const [genre, booksInGenre] = await Promise.all([
    Genre.findById(req.params.id).exec(),
    Book.find({ genre: req.params.id }, "title summary").exec(),
  ]);
  if (genre === null) {
    // 結果なし
    res.redirect("/catalog/genres");
  }

  res.render("genre_delete", {
    title: "ジャンル削除",
    genre: genre,
    genre_books: booksInGenre,
  });
});

// ジャンル削除処理（POST）
exports.genre_delete_post = asyncHandler(async (req, res, next) => {
  // ジャンルの詳細と関連するすべての本を（並列で）取得
  const [genre, booksInGenre] = await Promise.all([
    Genre.findById(req.params.id).exec(),
    Book.find({ genre: req.params.id }, "title summary").exec(),
  ]);

  if (booksInGenre.length > 0) {
    // ジャンルに本がある場合、GETルートと同様に表示
    res.render("genre_delete", {
      title: "ジャンル削除",
      genre: genre,
      genre_books: booksInGenre,
    });
    return;
  } else {
    // ジャンルに本がなければ削除し、ジャンル一覧へリダイレクト
    await Genre.findByIdAndDelete(req.body.id);
    res.redirect("/catalog/genres");
  }
});

// ジャンル更新フォーム（GET）を表示
exports.genre_update_get = asyncHandler(async (req, res, next) => {
  const genre = await Genre.findById(req.params.id).exec();

  if (genre === null) {
    // 結果なし
    const err = new Error("ジャンルが見つかりません");
    err.status = 404;
    return next(err);
  }

  res.render("genre_form", { title: "ジャンル更新", genre: genre });
});

// ジャンル更新処理（POST）
exports.genre_update_post = [
  // nameフィールドのバリデーションとサニタイズ
  body("name", "ジャンル名は3文字以上で入力してください")
    .trim()
    .isLength({ min: 3 })
    .escape(),

  // バリデーションとサニタイズ後のリクエスト処理
  asyncHandler(async (req, res, next) => {
    // バリデーションエラーを抽出
    const errors = validationResult(req);

    // エスケープ・トリム済みデータと古いIDでジャンルオブジェクトを作成
    const genre = new Genre({
      name: req.body.name,
      _id: req.params.id,
    });

    if (!errors.isEmpty()) {
      // エラーあり。フォームを再表示
      res.render("genre_form", {
        title: "ジャンル更新",
        genre: genre,
        errors: errors.array(),
      });
      return;
    } else {
      // フォームデータは有効。レコードを更新
      await Genre.findByIdAndUpdate(req.params.id, genre);
      res.redirect(genre.url);
    }
  }),
];
