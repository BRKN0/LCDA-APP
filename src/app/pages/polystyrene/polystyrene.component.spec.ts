import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { PolystyreneComponent } from './polystyrene.component';

describe('PolystyreneComponent', () => {
  let component: PolystyreneComponent;
  let fixture: ComponentFixture<PolystyreneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, PolystyreneComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PolystyreneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
