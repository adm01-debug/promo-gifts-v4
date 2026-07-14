import { describe, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LayoutStep } from '@/pages/magazine/components/steps/LayoutStep';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

vi.mock('@/pages/magazine/components/MagazinePageRenderer', () => ({
  MagazinePageRenderer: () => null,
}));

describe('d', () => {
  it('debug', () => {
    const items = Array.from({length:3}, (_,i)=>({
      id:`i-${i}`, productId:`p-${i}`, variantColorName:null, position:i, pageNumber:null, overrides:{},
      productSnapshot:{id:`p-${i}`,name:`N${i}`,sku:'S',shortDescription:'',description:null,price:0,image_url:'',images:[],colors:[],materials:[],hasPersonalization:false,category_id:null,category_name:null}
    }));
    const mag = {id:'m',ownerId:'u',organizationId:null,title:'t',subtitle:'',templateId:'catalog-grid',branding:{...DEFAULT_BRANDING},content:{...DEFAULT_MAGAZINE_CONTENT},items,pageOrder:null,status:'draft',publicToken:null,pdfUrl:null,publishedAt:null,createdAt:'',updatedAt:''} as any;
    const { container } = render(<LayoutStep magazine={mag} onReorder={()=>{}} onRemove={()=>{}}/>);
    console.log('LI count:', container.querySelectorAll('li').length);
    console.log('First LI:', container.querySelector('li')?.outerHTML?.slice(0,300));
  });
});
