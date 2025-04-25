import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { VinylCutsComponent } from './vinyl-cuts.component';

describe('VinylCutsComponent', () => {
  let component: VinylCutsComponent;
  let fixture: ComponentFixture<VinylCutsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ CommonModule, VinylCutsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VinylCutsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
