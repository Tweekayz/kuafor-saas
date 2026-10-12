"use client";

import { useActionState } from "react";

import { adjustStock, deleteProduct, saveProduct } from "@/lib/business/actions";
import type { Product } from "@/lib/business/types";

import { DeleteButton } from "../_components/forms";
import { FormMessage, inputClass, labelClass, primaryButton } from "../_components/ui";

/** product verilmezse "yeni ürün" formu olarak çalışır. */
export function ProductForm({ salonId, product }: { salonId: string; product?: Product }) {
  const [state, action, pending] = useActionState(saveProduct, null);

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className={`col-span-2 ${labelClass}`}>
          Ürün adı
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={product?.name}
            placeholder={product ? undefined : "örn. Oksidan 30 vol"}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Kategori
          <input
            name="category"
            maxLength={60}
            defaultValue={product?.category ?? ""}
            placeholder={product ? undefined : "örn. Boya"}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Birim
          <input
            name="unit"
            maxLength={20}
            defaultValue={product?.unit ?? "adet"}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        {!product && (
          <label className={labelClass}>
            Başlangıç stoğu
            <input
              name="quantity"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        )}
        <label className={labelClass}>
          Kritik seviye
          <input
            name="critical_level"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product?.critical_level ?? 0}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Alış fiyatı
          <input
            name="purchase_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product?.purchase_price ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Satış fiyatı
          <input
            name="sale_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={product?.sale_price ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {product && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={product.is_active} />
            Aktif
          </label>
        )}
        <div className="ml-auto flex items-center gap-3">
          <FormMessage state={state} />
          {product && (
            <DeleteButton
              confirmText={`"${product.name}" ve tüm stok hareketleri silinsin mi?`}
              action={() => deleteProduct(salonId, product.id)}
            />
          )}
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Kaydediliyor…" : product ? "Kaydet" : "Ürün ekle"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Stok hareketi: alım, kullanım, satış ya da sayım düzeltmesi. */
export function StockMoveForm({ salonId, product }: { salonId: string; product: Product }) {
  const [state, action, pending] = useActionState(adjustStock, null);

  return (
    <form action={action}>
      <input type="hidden" name="salon_id" value={salonId} />
      <input type="hidden" name="product_id" value={product.id} />
      <input type="hidden" name="current" value={product.quantity} />
      <div className="flex flex-wrap items-end gap-2">
        <label className={labelClass}>
          Hareket
          <select name="reason" defaultValue="usage" className={`mt-1 ${inputClass}`}>
            <option value="purchase">Alım (stok girişi)</option>
            <option value="usage">Salonda kullanım</option>
            <option value="sale">Müşteriye satış</option>
            <option value="adjustment">Sayım (yeni miktarı yaz)</option>
          </select>
        </label>
        <label className={`w-24 ${labelClass}`}>
          Miktar
          <input
            name="amount"
            type="number"
            required
            min={0}
            step="0.01"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className={`min-w-32 flex-1 ${labelClass}`}>
          Not
          <input name="note" maxLength={200} className={`mt-1 ${inputClass}`} />
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "İşleniyor…" : "Uygula"}
        </button>
      </div>
      <div className="mt-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
