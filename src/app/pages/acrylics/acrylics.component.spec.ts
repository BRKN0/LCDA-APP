import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { AcrylicsComponent } from './acrylics.component';

describe('AcrylicsComponent', () => {
  let component: AcrylicsComponent;
  let fixture: ComponentFixture<AcrylicsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcrylicsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AcrylicsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
