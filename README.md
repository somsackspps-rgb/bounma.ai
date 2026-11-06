# ບຸນມາ AI v3.4 — ວິທີຕິດຕັ້ງ (Round 0 + 1)

## 1) ຖານຂໍ້ມູນ (Supabase → SQL Editor)
ຣັນໄຟລ໌ `supabase_setup.sql` ທັງໝົດ (ຣັນຊ້ຳໄດ້ ບໍ່ລຶບຂໍ້ມູນ) — ສ່ວນໃໝ່ຢູ່ທ້າຍໄຟລ໌ "v3.4".
ຕື່ມ: ປະເພດຂໍ້ຄວາມ file/link, list_group_members, remove_group_member, ປ້ອງກັນບໍ່ໃຫ້ເຈົ້າຂອງຫ້ອງແກ້ຄ່າອື່ນນອກຈາກ ຊື່/ຄຳອະທິບາຍ.

## 2) ອັບໂຫຼດເວັບ (GitHub Pages)
ອັບໂຫຼດທຸກໄຟລ໌ **ລວມໂຟນເດີ `js/` ແລະ `assets/`** ແລ້ວ Ctrl+Shift+R ໃນເບົາເຊີ.
ຜູ້ໃຊ້ເກົ່າຈະເຫັນແຖບ "ມີເວີຊັນໃໝ່ — ອັບເດດ". ທຸກຄັ້ງທີ່ປ່ອຍເວີຊັນໃໝ່ ໃຫ້ແກ້ `VERSION` ໃນ `sw.js`.

## 3) ລຶບຜູ້ໃຊ້ຖາວອນ (Edge Function)
ລຶບບັນຊີເຂົ້າລະບົບຕ້ອງໃຊ້ service-role key ຈຶ່ງເຮັດໃນເວັບບໍ່ໄດ້. ເລືອກວິທີໃດວິທີໜຶ່ງ:
- Dashboard: Edge Functions → Create function ຊື່ `delete-user` → ວາງໂຄ້ດຈາກ `supabase/functions/delete-user/index.ts` → Deploy (ເປີດ "Verify JWT" ໄວ້)
- CLI: `supabase functions deploy delete-user --project-ref pqowiefyxyhpzwvzydlr`
ກົດລະບຽບ: ສະເພາະ Admin, ລຶບຕົວເອງບໍ່ໄດ້, ລຶບ Admin ຄົນສຸດທ້າຍບໍ່ໄດ້, ຫ້ອງທີ່ຜູ້ຖືກລຶບສ້າງຈະໂອນໃຫ້ Admin ທີ່ກົດລຶບ.

## 4) (ແນະນຳ ເຮັດພາຍຫຼັງ) Tailwind ແບບ local
ຕອນນີ້ຍັງໃຊ້ `cdn.tailwindcss.com` (ເປັນສະບັບທົດລອງ ຊ້າ ແລະຕ້ອງມີເນັດ). ເພື່ອປ່ຽນ:
1. ຕິດຕັ້ງ Node.js ໃນຄອມ
2. ໃນໂຟນເດີໂປຣເຈັກ: `npm run build:css` (ໄດ້ໄຟລ໌ `styles.css`)
3. ໃນ `index.html` ລຶບ 2 ບລັອກ `<script src="https://cdn.tailwindcss.com">` + `tailwind.config = ...` ແລ້ວໃສ່ `<link rel="stylesheet" href="styles.css">`
4. ເພີ່ມ `./styles.css` ໃນ APP_SHELL ຂອງ `sw.js` ແລະແກ້ VERSION

## 5) ກວດດ້ວຍເຄື່ອງຈິງ (ຕ້ອງເຮັດ — ຂ້ອຍທົດສອບໃນເຄື່ອງຈິງບໍ່ໄດ້)
- Android Chrome: ປຸ່ມ "📲 ຕິດຕັ້ງແອັບ" ຂຶ້ນໜ້າຕ່າງຕິດຕັ້ງ; ກົດ "ເປີດແອັບ" ຂອງ ChatGPT/Claude/Gemini ແລ້ວເປີດແອັບ (ຖ້າມີ) ຫຼືເວັບ (ຖ້າບໍ່ມີ)
- iPhone Safari: ປຸ່ມຕິດຕັ້ງສະແດງຂັ້ນຕອນ Share → Add to Home Screen; ກວດວ່າ AI ໃດເປີດແອັບໄດ້
- ຖ້າແອັບໃດເປີດບໍ່ຖືກ: ແກ້ຕາຕະລາງ `APPS` ເທິງສຸດຂອງ `js/ai-apps.js` (pkg = ຊື່ແພັກເກດ Android, ios = URL scheme)
- ລອງລິ້ງຫ້ອງ: ຄູກົດ "ແບ່ງປັນລິ້ງ" → ເປີດໃນນັກຮຽນທີ່ຍັງບໍ່ລັອກອິນ → ສະໝັກ/ເຂົ້າສູ່ລະບົບ → ຄວນເຂົ້າຫ້ອງເອງ

## ຂໍ້ຈຳກັດທີ່ຄວນຮູ້
- ໄຟລ໌ແນບເກັບໃນ IndexedDB ຂອງເຄື່ອງຜູ້ສົ່ງ: ຖ້າລ້າງຂໍ້ມູນເບົາເຊີ/ເປີດໂໝດສ່ວນຕົວ ໄຟລ໌ຈະຫາຍ; ຄົນອື່ນໃນຫ້ອງເຫັນແຕ່ຊື່ໄຟລ໌ (ໃຫ້ແປະລິ້ງ Drive ຖ້າຢາກໃຫ້ເປີດໄດ້). ຂໍ້ຄວາມແນບເກົ່າ (ກ່ອນ v3.4) ຍັງເປີດໄດ້ຈາກ Supabase.
- ຮູບໂປຣໄຟລ໌ (avatar) ຍັງເກັບໃນ Supabase (ຮູບນ້ອຍ ≤ 2 MB).
- ອີເມວຂອງສະມາຊິກສະແດງສະເພາະຄູ/Admin, ແຕ່ນະໂຍບາຍ `profiles_select_classmates` ເດີມຍັງໃຫ້ເພື່ອນຮ່ວມຫ້ອງອ່ານແຖວໂປຣໄຟລ໌ (ລວມອີເມວ) ຜ່ານ API ໂດຍກົງ — ແກ້ໃນຮອບ Security.
